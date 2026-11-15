// Saved ideas: a person's private "maybe" pile. Shared by the item and saved-idea actions.
// Not a "use server" file, so nothing here is callable from the browser.
import { all, batch, now, run, type Stmt } from "./db";
import type { ItemFields } from "./items";
import type { Person } from "./types";

/** The "Add to" choice that means "Save for later (only me)". Person ids start at 1. */
export const SAVE_FOR_LATER = 0;

/** "Maybe for" ids from a form, limited to real people other than the viewer. */
export async function readMaybeFor(viewer: Person, raw: FormDataEntryValue[]): Promise<number[]> {
  const wanted = new Set(raw.map(Number).filter((id) => Number.isInteger(id) && id !== viewer.id));
  if (wanted.size === 0) return [];
  const people = await all<{ id: number }>("SELECT id FROM people");
  return people.map((p) => p.id).filter((id) => wanted.has(id));
}

export function maybeForStatements(savedId: number, personIds: number[]): Stmt[] {
  return [
    { sql: "DELETE FROM saved_idea_for WHERE saved_id = ?", args: [savedId] },
    ...personIds.map((pid) => ({
      sql: "INSERT INTO saved_idea_for (saved_id, person_id) VALUES (?, ?)",
      args: [savedId, pid],
    })),
  ];
}

export async function insertSavedIdea(viewer: Person, f: ItemFields, maybeFor: FormDataEntryValue[]) {
  const forIds = await readMaybeFor(viewer, maybeFor);
  const t = now();
  const { id } = await run(
    `INSERT INTO saved_ideas (person_id, title, url, image_url, price, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [viewer.id, f.title, f.url, f.image_url, f.price, f.notes, t, t],
  );
  if (forIds.length) await batch(maybeForStatements(id, forIds));
  return id;
}
