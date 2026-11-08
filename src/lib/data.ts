import { all, get } from "./db";
import { defaultRevealAt } from "./schema";
import type { ClaimInfo, ClaimStatus, Household, Item, ItemView, Person } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// PRIVACY RULES (enforced here, on the server — never just hidden in the UI):
//  1. A list owner never receives claim data or secret ideas for their own list.
//  2. After the reveal date, the owner sees only *bought* claims ("From Jo").
//  3. Kids don't log in, so every adult (including parents) sees claims on kids' lists.
// ─────────────────────────────────────────────────────────────────────────────

export async function getPerson(id: number) {
  if (!Number.isInteger(id)) return undefined;
  return get<Person>("SELECT * FROM people WHERE id = ?", [id]);
}

export async function getPeople() {
  return all<Person>("SELECT * FROM people ORDER BY is_child, name COLLATE NOCASE");
}

export async function getHouseholds() {
  return all<Household>("SELECT * FROM households ORDER BY name COLLATE NOCASE");
}

export async function getManagerIds(childId: number): Promise<number[]> {
  const rows = await all<{ manager_id: number }>("SELECT manager_id FROM managers WHERE child_id = ?", [childId]);
  return rows.map((r) => r.manager_id);
}

/** child id → manager ids */
export async function getManagerMap(): Promise<Record<number, number[]>> {
  const rows = await all<{ child_id: number; manager_id: number }>("SELECT child_id, manager_id FROM managers");
  const map: Record<number, number[]> = {};
  for (const r of rows) (map[r.child_id] ??= []).push(r.manager_id);
  return map;
}

export async function getSetting(key: string): Promise<string | null> {
  return (await get<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]))?.value ?? null;
}

export async function getRevealAt(): Promise<Date> {
  const v = await getSetting("reveal_at");
  const d = new Date(v ?? defaultRevealAt());
  return isNaN(d.getTime()) ? new Date(defaultRevealAt()) : d;
}

export function canEditItem(
  viewer: Person,
  item: Pick<Item, "is_idea" | "added_by">,
  owner: Person,
  managerIds: number[],
): boolean {
  const manages = owner.is_child === 1 && managerIds.includes(viewer.id);
  if (item.is_idea) return item.added_by === viewer.id || manages;
  return viewer.id === owner.id || manages;
}

export async function getListView(viewer: Person, owner: Person) {
  const isOwnerView = viewer.id === owner.id;
  const managerIds = owner.is_child ? await getManagerIds(owner.id) : [];
  const manages = managerIds.includes(viewer.id);
  const revealAt = await getRevealAt();
  const revealed = isOwnerView && Date.now() >= revealAt.getTime();
  const showClaims = !isOwnerView || revealed;

  // Owner: no secret ideas — except, after the reveal, ideas someone actually bought.
  let filter = "";
  if (isOwnerView) {
    filter = revealed
      ? " AND (i.is_idea = 0 OR EXISTS (SELECT 1 FROM claims c WHERE c.item_id = i.id AND c.status = 'bought'))"
      : " AND i.is_idea = 0";
  }

  const items = await all<Item & { added_by_name: string | null }>(
    `SELECT i.*, a.name AS added_by_name
       FROM items i LEFT JOIN people a ON a.id = i.added_by
      WHERE i.owner_id = ? AND i.removed_at IS NULL${filter}
      ORDER BY i.position, i.id`,
    [owner.id],
  );

  const claimsByItem = new Map<number, ClaimInfo[]>();
  if (showClaims) {
    const claims = await all<ClaimInfo>(
      `SELECT c.item_id, c.claimer_id, p.name AS claimer_name, c.quantity, c.status
         FROM claims c
         JOIN items i ON i.id = c.item_id
         JOIN people p ON p.id = c.claimer_id
        WHERE i.owner_id = ?${isOwnerView ? " AND c.status = 'bought'" : ""}
        ORDER BY c.created_at`,
      [owner.id],
    );
    for (const c of claims) {
      const list = claimsByItem.get(c.item_id) ?? [];
      list.push(c);
      claimsByItem.set(c.item_id, list);
    }
  }

  const views: ItemView[] = items.map((i) => ({
    ...i,
    claims: showClaims ? (claimsByItem.get(i.id) ?? []) : null,
  }));

  return {
    owner,
    isOwnerView,
    canEdit: isOwnerView || manages,
    manages,
    managerIds,
    revealAt,
    revealed,
    items: views.filter((i) => !i.is_idea),
    ideas: views.filter((i) => i.is_idea),
  };
}

export type PersonStats = { total: number; available: number };

export async function getHomeView(viewer: Person) {
  const [people, households, managers, rows, myClaims] = await Promise.all([
    getPeople(),
    getHouseholds(),
    getManagerMap(),
    all<{ owner_id: number; quantity: number; is_idea: number; claimed: number }>(
      `SELECT i.owner_id, i.quantity, i.is_idea,
              COALESCE((SELECT SUM(c.quantity) FROM claims c WHERE c.item_id = i.id), 0) AS claimed
         FROM items i WHERE i.removed_at IS NULL`,
    ),
    all<{ status: ClaimStatus; n: number }>(
      "SELECT c.status, COUNT(*) AS n FROM claims c JOIN items i ON i.id = c.item_id WHERE c.claimer_id = ? AND i.removed_at IS NULL GROUP BY c.status",
      [viewer.id],
    ),
  ]);

  const stats: Record<number, PersonStats> = {};
  for (const r of rows) {
    const own = r.owner_id === viewer.id;
    if (own && r.is_idea) continue; // never count secret ideas on your own list
    const s = (stats[r.owner_id] ??= { total: 0, available: 0 });
    s.total += 1;
    if (!own && r.claimed < r.quantity) s.available += 1; // availability only for other people's lists
  }

  return {
    people,
    households,
    managers,
    stats,
    reserved: myClaims.find((c) => c.status === "reserved")?.n ?? 0,
    bought: myClaims.find((c) => c.status === "bought")?.n ?? 0,
  };
}

export type ShoppingRow = {
  item_id: number;
  quantity: number;
  status: ClaimStatus;
  created_at: string;
  seen_at: string;
  title: string;
  url: string | null;
  image_url: string | null;
  price: string | null;
  notes: string | null;
  item_quantity: number;
  removed_at: string | null;
  updated_at: string;
  owner_id: number;
  owner_name: string;
  is_idea: number;
};

export async function getShopping(viewer: Person) {
  return all<ShoppingRow>(
    `SELECT c.item_id, c.quantity, c.status, c.created_at, c.seen_at,
            i.title, i.url, i.image_url, i.price, i.notes, i.quantity AS item_quantity,
            i.removed_at, i.updated_at, i.owner_id, p.name AS owner_name, i.is_idea
       FROM claims c
       JOIN items i ON i.id = c.item_id
       JOIN people p ON p.id = i.owner_id
      WHERE c.claimer_id = ?
      ORDER BY p.name COLLATE NOCASE, i.created_at`,
    [viewer.id],
  );
}
