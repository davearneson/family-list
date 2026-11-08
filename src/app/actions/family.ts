"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getManagerIds, getPerson } from "@/lib/data";
import { all, batch, get, now, run, type Stmt } from "@/lib/db";
import { requireViewer } from "@/lib/session";

async function requireAdmin() {
  const viewer = await requireViewer("/family");
  if (!viewer.is_admin) redirect("/");
  return viewer;
}

const clean = (v: FormDataEntryValue | null, max = 60) => String(v ?? "").trim().slice(0, max);
const optionalId = (v: FormDataEntryValue | null) => {
  const n = Number(v);
  return v && Number.isInteger(n) && n > 0 ? n : null;
};

/** Only real adults can be parents. */
async function validParentIds(fd: FormData): Promise<number[]> {
  const wanted = fd.getAll("parents").map(Number).filter(Number.isInteger);
  if (!wanted.length) return [];
  const adults = await all<{ id: number }>("SELECT id FROM people WHERE is_child = 0");
  const ok = new Set(adults.map((a) => a.id));
  return [...new Set(wanted)].filter((id) => ok.has(id));
}

function replaceManagers(childId: number, parentIds: number[]): Stmt[] {
  return [
    { sql: "DELETE FROM managers WHERE child_id = ?", args: [childId] },
    ...parentIds.map((pid) => ({ sql: "INSERT INTO managers (child_id, manager_id) VALUES (?, ?)", args: [childId, pid] })),
  ];
}

// ── Households ──────────────────────────────────────────────────────────────

export async function addHousehold(fd: FormData) {
  await requireAdmin();
  const name = clean(fd.get("name"));
  if (name) await run("INSERT INTO households (name, created_at) VALUES (?, ?)", [name, now()]);
  refresh();
}

export async function renameHousehold(fd: FormData) {
  await requireAdmin();
  const name = clean(fd.get("name"));
  if (name) await run("UPDATE households SET name = ? WHERE id = ?", [name, Number(fd.get("id"))]);
  refresh();
}

export async function deleteHousehold(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("id"));
  const members = await get<{ n: number }>("SELECT COUNT(*) AS n FROM people WHERE household_id = ?", [id]);
  if (members && members.n === 0) await run("DELETE FROM households WHERE id = ?", [id]);
  refresh();
}

// ── People ──────────────────────────────────────────────────────────────────

export async function addPerson(fd: FormData) {
  await requireAdmin();
  const name = clean(fd.get("name"));
  if (!name) return refresh();
  const isChild = fd.get("kind") === "kid";
  const parents = isChild ? await validParentIds(fd) : [];
  const p = await run("INSERT INTO people (name, household_id, is_child, is_admin, created_at) VALUES (?, ?, ?, 0, ?)", [
    name,
    optionalId(fd.get("household_id")),
    isChild ? 1 : 0,
    now(),
  ]);
  if (isChild && parents.length) await batch(replaceManagers(p.id, parents));
  refresh();
}

export async function updatePerson(fd: FormData) {
  const viewer = await requireAdmin();
  const person = await getPerson(Number(fd.get("id")));
  if (!person) return refresh();
  const name = clean(fd.get("name")) || person.name;
  // You can't remove your own admin access (so the family never gets locked out).
  const isAdmin = person.is_child ? 0 : person.id === viewer.id ? 1 : fd.get("is_admin") ? 1 : 0;
  const stmts: Stmt[] = [
    {
      sql: "UPDATE people SET name = ?, household_id = ?, is_admin = ? WHERE id = ?",
      args: [name, optionalId(fd.get("household_id")), isAdmin, person.id],
    },
  ];
  if (person.is_child) {
    const parents = await validParentIds(fd);
    if (parents.length) stmts.push(...replaceManagers(person.id, parents));
  }
  await batch(stmts);
  refresh();
}

export async function deletePerson(fd: FormData) {
  const viewer = await requireAdmin();
  const id = Number(fd.get("id"));
  if (id === viewer.id) return refresh();
  await batch([
    { sql: "DELETE FROM claims WHERE claimer_id = ?", args: [id] },
    { sql: "DELETE FROM claims WHERE item_id IN (SELECT id FROM items WHERE owner_id = ?)", args: [id] },
    { sql: "DELETE FROM items WHERE owner_id = ?", args: [id] },
    { sql: "UPDATE items SET added_by = NULL WHERE added_by = ?", args: [id] },
    { sql: "DELETE FROM managers WHERE child_id = ? OR manager_id = ?", args: [id, id] },
    { sql: "DELETE FROM people WHERE id = ?", args: [id] },
  ]);
  refresh();
}

/** Parents (or an admin) can change who manages a kid's list. */
export async function setManagers(fd: FormData) {
  const viewer = await requireViewer();
  const child = await getPerson(Number(fd.get("child_id")));
  if (!child || !child.is_child) return refresh();
  const current = await getManagerIds(child.id);
  if (!viewer.is_admin && !current.includes(viewer.id)) return refresh();
  const parents = await validParentIds(fd);
  if (parents.length) await batch(replaceManagers(child.id, parents));
  refresh();
}

// ── Settings ────────────────────────────────────────────────────────────────

export async function saveSettings(fd: FormData) {
  await requireAdmin();
  const stmts: Stmt[] = [];
  const reveal = String(fd.get("reveal_at") ?? "");
  const d = new Date(reveal);
  if (reveal && !isNaN(d.getTime())) {
    stmts.push({ sql: "INSERT OR REPLACE INTO settings (key, value) VALUES ('reveal_at', ?)", args: [d.toISOString()] });
  }
  if (fd.has("shortcut_url")) {
    const link = clean(fd.get("shortcut_url"), 500);
    const ok = !link || /^https:\/\/(www\.)?icloud\.com\/shortcuts\//.test(link);
    if (ok) stmts.push({ sql: "INSERT OR REPLACE INTO settings (key, value) VALUES ('shortcut_url', ?)", args: [link] });
  }
  if (stmts.length) await batch(stmts);
  refresh();
}
