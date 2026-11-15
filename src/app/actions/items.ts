"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { canEditItem, canEditList, getManagerIds, getPerson } from "@/lib/data";
import { all, batch, get, now, run } from "@/lib/db";
import { clampInt, insertItem, readItemFields } from "@/lib/items";
import { SAVE_FOR_LATER, insertSavedIdea } from "@/lib/saved";
import { extractUrl, fetchLinkPreview } from "@/lib/linkPreview";
import { requireViewer } from "@/lib/session";
import type { Item, Person } from "@/lib/types";

export type ItemFormState = { error: string | null };

async function loadEditable(viewer: Person, itemId: number) {
  const item = await get<Item>("SELECT * FROM items WHERE id = ? AND removed_at IS NULL", [itemId]);
  if (!item) return null;
  const owner = await getPerson(item.owner_id);
  if (!owner) return null;
  const managerIds = owner.is_child ? await getManagerIds(owner.id) : [];
  return canEditItem(viewer, item, owner, managerIds) ? { item, owner } : null;
}

// ── Adding & editing ────────────────────────────────────────────────────────

export async function addItem(_: ItemFormState, fd: FormData): Promise<ItemFormState> {
  const viewer = await requireViewer("/add");
  const parsed = readItemFields(fd);
  if ("error" in parsed) return { error: parsed.error ?? null };

  // "Save for later": goes in the viewer's private saved ideas, not on any list.
  if (fd.get("owner_id") === String(SAVE_FOR_LATER)) {
    await insertSavedIdea(viewer, parsed.fields, fd.getAll("maybe_for"));
    redirect("/shopping");
  }

  const owner = await getPerson(Number(fd.get("owner_id")));
  if (!owner) return { error: "Pick whose list this goes on." };
  // Anyone who isn't the owner (or a kid's parent) is adding a secret idea.
  const managerIds = owner.is_child ? await getManagerIds(owner.id) : [];
  await insertItem(owner, viewer, !canEditList(viewer, owner, managerIds), parsed.fields);
  redirect(`/list/${owner.id}`);
}

export async function updateItem(_: ItemFormState, fd: FormData): Promise<ItemFormState> {
  const viewer = await requireViewer();
  const found = await loadEditable(viewer, Number(fd.get("item_id")));
  if (!found) return { error: "You can't edit this item (it may have been removed)." };
  const { item, owner } = found;
  const parsed = readItemFields(fd);
  if ("error" in parsed) return { error: parsed.error ?? null };
  const f = parsed.fields;

  // Bump updated_at only for changes a gift-giver would care about (triggers a heads-up).
  const changed =
    f.title !== item.title || f.url !== item.url || f.price !== item.price || f.notes !== item.notes || f.quantity !== item.quantity;
  await run(
    `UPDATE items SET title = ?, url = ?, image_url = ?, price = ?, notes = ?, quantity = ?, most_wanted = ?, updated_at = ? WHERE id = ?`,
    [f.title, f.url, f.image_url, f.price, f.notes, f.quantity, item.is_idea ? 0 : f.most_wanted, changed ? now() : item.updated_at, item.id],
  );
  redirect(`/list/${owner.id}`);
}

export async function removeItem(fd: FormData) {
  const viewer = await requireViewer();
  const found = await loadEditable(viewer, Number(fd.get("item_id")));
  if (!found) redirect("/");
  const { item } = found;
  // If someone already claimed it, keep a tombstone so they get a heads-up.
  // The response is identical either way (the owner was already warned on the edit page, if at all).
  const claimed = await get<{ n: number }>("SELECT COUNT(*) AS n FROM claims WHERE item_id = ?", [item.id]);
  if (claimed && claimed.n > 0) await run("UPDATE items SET removed_at = ? WHERE id = ?", [now(), item.id]);
  else await run("DELETE FROM items WHERE id = ?", [item.id]);
  redirect(`/list/${item.owner_id}`);
}

export async function toggleMostWanted(fd: FormData) {
  const viewer = await requireViewer();
  const found = await loadEditable(viewer, Number(fd.get("item_id")));
  if (found && !found.item.is_idea) {
    await run("UPDATE items SET most_wanted = ? WHERE id = ?", [found.item.most_wanted ? 0 : 1, found.item.id]);
  }
  refresh();
}

/** Saves a new order for a list. Only the owner, or a parent on a kid's list. Secret ideas are never touched. */
export async function reorderItems(fd: FormData) {
  const viewer = await requireViewer();
  const owner = await getPerson(Number(fd.get("owner_id")));
  if (!owner) redirect("/");
  const managerIds = owner.is_child ? await getManagerIds(owner.id) : [];
  if (!canEditList(viewer, owner, managerIds)) redirect(`/list/${owner.id}`);

  const current = await all<{ id: number }>(
    "SELECT id FROM items WHERE owner_id = ? AND is_idea = 0 AND removed_at IS NULL ORDER BY position, id",
    [owner.id],
  );
  const left = new Set(current.map((r) => r.id));
  // The ids sent that belong on this list, once each, in the order sent…
  const sent = String(fd.get("order") ?? "")
    .split(",")
    .map(Number)
    .filter((id) => left.delete(id));
  // …then anything not sent (say, added meanwhile by the other parent) at the end, in its old order.
  const order = [...sent, ...current.map((r) => r.id).filter((id) => left.has(id))];
  // updated_at is left alone: a new order isn't a change gift-givers need a heads-up about.
  if (order.length) {
    await batch(order.map((id, i) => ({ sql: "UPDATE items SET position = ? WHERE id = ?", args: [i + 1, id] })));
  }
  redirect(`/list/${owner.id}`);
}

// ── Claims ──────────────────────────────────────────────────────────────────

export async function claimItem(fd: FormData) {
  const viewer = await requireViewer();
  const itemId = Number(fd.get("item_id"));
  const item = await get<Item>("SELECT * FROM items WHERE id = ?", [itemId]);
  // Same error whether the item is missing or it's your own: nothing to probe.
  if (!item || item.owner_id === viewer.id) throw new Error("Not allowed");
  const status = fd.get("status") === "bought" ? "bought" : "reserved";
  const want = clampInt(fd.get("quantity"), 1, 99);
  const t = now();
  // Atomic: only succeeds if enough quantity is still free.
  await run(
    `INSERT INTO claims (item_id, claimer_id, quantity, status, created_at, seen_at)
     SELECT ?, ?, ?, ?, ?, ?
      WHERE (SELECT i.quantity - COALESCE((SELECT SUM(c.quantity) FROM claims c WHERE c.item_id = i.id AND c.claimer_id != ?), 0)
               FROM items i WHERE i.id = ? AND i.removed_at IS NULL) >= ?
     ON CONFLICT (item_id, claimer_id) DO UPDATE SET quantity = excluded.quantity, status = excluded.status`,
    [itemId, viewer.id, want, status, t, t, viewer.id, itemId, want],
  );
  refresh();
}

export async function setClaimStatus(fd: FormData) {
  const viewer = await requireViewer();
  const status = fd.get("status") === "bought" ? "bought" : "reserved";
  await run("UPDATE claims SET status = ? WHERE item_id = ? AND claimer_id = ?", [status, Number(fd.get("item_id")), viewer.id]);
  refresh();
}

export async function releaseClaim(fd: FormData) {
  const viewer = await requireViewer();
  const itemId = Number(fd.get("item_id"));
  await run("DELETE FROM claims WHERE item_id = ? AND claimer_id = ?", [itemId, viewer.id]);
  // Clean up tombstoned items nobody is holding anymore.
  await run(
    "DELETE FROM items WHERE id = ? AND removed_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM claims WHERE item_id = ?)",
    [itemId, itemId],
  );
  refresh();
}

export async function acknowledgeChange(fd: FormData) {
  const viewer = await requireViewer();
  await run("UPDATE claims SET seen_at = ? WHERE item_id = ? AND claimer_id = ?", [now(), Number(fd.get("item_id")), viewer.id]);
  refresh();
}

// ── Link lookup (called from the add form) ──────────────────────────────────

export async function previewLink(
  input: string,
): Promise<{ ok: true; url: string; title?: string; image?: string; price?: string } | { ok: false }> {
  await requireViewer();
  const url = extractUrl(String(input ?? "").slice(0, 3000));
  if (!url) return { ok: false };
  try {
    return { ok: true, ...(await fetchLinkPreview(url)) };
  } catch {
    return { ok: false };
  }
}
