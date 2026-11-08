"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { canEditItem, getManagerIds, getPerson } from "@/lib/data";
import { get, now, run } from "@/lib/db";
import { extractUrl, fetchLinkPreview } from "@/lib/linkPreview";
import { requireViewer } from "@/lib/session";
import type { Item, Person } from "@/lib/types";

export type ItemFormState = { error: string | null };

const text = (fd: FormData, key: string, max: number) => String(fd.get(key) ?? "").trim().slice(0, max);

function httpUrl(v: string): string | null {
  if (!v) return null;
  const candidate = extractUrl(v) ?? (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v) ? `https://${v}` : null);
  if (!candidate) return null;
  try {
    const u = new URL(candidate);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function clampInt(v: FormDataEntryValue | null, min: number, max: number): number {
  const n = Math.round(Number(v ?? min));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

function readItemFields(fd: FormData) {
  const title = text(fd, "title", 200);
  const rawUrl = text(fd, "url", 2000);
  const url = httpUrl(rawUrl);
  if (!title) return { error: "Give it a name so people know what it is." } as const;
  if (rawUrl && !url) return { error: "That link doesn't look right. It should start with https://" } as const;
  return {
    fields: {
      title,
      url,
      image_url: httpUrl(text(fd, "image_url", 2000)),
      price: text(fd, "price", 40) || null,
      notes: text(fd, "notes", 1000) || null,
      quantity: clampInt(fd.get("quantity"), 1, 99),
      most_wanted: fd.get("most_wanted") ? 1 : 0,
    },
  } as const;
}

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
  const owner = await getPerson(Number(fd.get("owner_id")));
  if (!owner) return { error: "Pick whose list this goes on." };
  const parsed = readItemFields(fd);
  if ("error" in parsed) return { error: parsed.error ?? null };

  // Anyone who isn't the owner (or a kid's parent) is adding a secret idea.
  const managerIds = owner.is_child ? await getManagerIds(owner.id) : [];
  const isIdea = !(owner.id === viewer.id || managerIds.includes(viewer.id));
  const f = parsed.fields;
  const t = now();
  await run(
    `INSERT INTO items (owner_id, added_by, is_idea, title, url, image_url, price, notes, quantity, most_wanted, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [owner.id, viewer.id, isIdea ? 1 : 0, f.title, f.url, f.image_url, f.price, f.notes, f.quantity, isIdea ? 0 : f.most_wanted, t, t],
  );
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
  // The response is identical either way, so the owner learns nothing.
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
