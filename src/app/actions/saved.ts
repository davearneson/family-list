"use server";

import { redirect } from "next/navigation";
import { canEditList, getManagerIds, getPerson, getSavedIdea } from "@/lib/data";
import { batch, now } from "@/lib/db";
import { insertItemStmt, readItemFields } from "@/lib/items";
import { maybeForStatements, readMaybeFor } from "@/lib/saved";
import { requireViewer } from "@/lib/session";
import type { ItemFormState } from "./items";

// Every action loads the saved idea through getSavedIdea(viewer, …), which only finds your own.

export async function updateSavedIdea(_: ItemFormState, fd: FormData): Promise<ItemFormState> {
  const viewer = await requireViewer();
  const saved = await getSavedIdea(viewer, Number(fd.get("saved_id")));
  if (!saved) return { error: "This idea is gone. It may have been moved to a list or deleted." };
  const parsed = readItemFields(fd);
  if ("error" in parsed) return { error: parsed.error ?? null };
  const f = parsed.fields;
  const forIds = await readMaybeFor(viewer, fd.getAll("maybe_for"));
  await batch([
    {
      sql: "UPDATE saved_ideas SET title = ?, url = ?, image_url = ?, price = ?, notes = ?, updated_at = ? WHERE id = ? AND person_id = ?",
      args: [f.title, f.url, f.image_url, f.price, f.notes, now(), saved.id, viewer.id],
    },
    ...maybeForStatements(saved.id, forIds),
  ]);
  redirect("/shopping");
}

export async function deleteSavedIdea(fd: FormData) {
  const viewer = await requireViewer();
  const saved = await getSavedIdea(viewer, Number(fd.get("saved_id")));
  if (saved) {
    await batch([
      ...maybeForStatements(saved.id, []),
      { sql: "DELETE FROM saved_ideas WHERE id = ? AND person_id = ?", args: [saved.id, viewer.id] },
    ]);
  }
  redirect("/shopping");
}

/**
 * Puts a saved idea on a list: a normal item on your own list or a kid's you manage,
 * otherwise a secret idea. Optionally reserves it for you. All in one transaction.
 */
export async function moveSavedIdea(fd: FormData) {
  const viewer = await requireViewer();
  const saved = await getSavedIdea(viewer, Number(fd.get("saved_id")));
  if (!saved) redirect("/shopping");
  const owner = await getPerson(Number(fd.get("owner_id")));
  if (!owner) redirect(`/saved/${saved.id}/move`);

  const managerIds = owner.is_child ? await getManagerIds(owner.id) : [];
  const isIdea = !canEditList(viewer, owner, managerIds);
  const fields = {
    title: saved.title,
    url: saved.url,
    image_url: saved.image_url,
    price: saved.price,
    notes: saved.notes,
    quantity: 1,
    most_wanted: 0 as const,
  };
  // You can't reserve things on your own list.
  const reserve = !!fd.get("reserve") && owner.id !== viewer.id;
  const t = now();

  await batch([
    insertItemStmt(owner, viewer, isIdea, fields),
    ...(reserve
      ? [
          {
            sql: `INSERT INTO claims (item_id, claimer_id, quantity, status, created_at, seen_at)
                  VALUES (last_insert_rowid(), ?, 1, 'reserved', ?, ?)`,
            args: [viewer.id, t, t],
          },
        ]
      : []),
    ...maybeForStatements(saved.id, []),
    { sql: "DELETE FROM saved_ideas WHERE id = ? AND person_id = ?", args: [saved.id, viewer.id] },
  ]);
  redirect(`/list/${owner.id}`);
}
