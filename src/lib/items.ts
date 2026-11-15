// Shared by the item and saved-idea actions. Not a "use server" file, so nothing here is callable from the browser.
import { now, run, type Stmt } from "./db";
import { extractUrl } from "./linkPreview";
import type { Person } from "./types";

export const text = (fd: FormData, key: string, max: number) => String(fd.get(key) ?? "").trim().slice(0, max);

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

export function clampInt(v: FormDataEntryValue | null, min: number, max: number): number {
  const n = Math.round(Number(v ?? min));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

export function readItemFields(fd: FormData) {
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

export type ItemFields = Extract<ReturnType<typeof readItemFields>, { fields: unknown }>["fields"];

/**
 * Adds an item at the bottom of someone's list.
 * isIdea = a gift-giver's secret idea (hidden from the owner); ideas are numbered separately.
 */
export function insertItemStmt(owner: Person, addedBy: Person, isIdea: boolean, f: ItemFields): Stmt {
  const t = now();
  return {
    sql: `INSERT INTO items (owner_id, added_by, is_idea, title, url, image_url, price, notes, quantity, most_wanted, position, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                  (SELECT COALESCE(MAX(position), 0) + 1 FROM items WHERE owner_id = ? AND is_idea = ?), ?, ?)`,
    args: [
      owner.id, addedBy.id, isIdea ? 1 : 0, f.title, f.url, f.image_url, f.price, f.notes, f.quantity, isIdea ? 0 : f.most_wanted,
      owner.id, isIdea ? 1 : 0, t, t,
    ],
  };
}

export async function insertItem(owner: Person, addedBy: Person, isIdea: boolean, f: ItemFields): Promise<number> {
  const stmt = insertItemStmt(owner, addedBy, isIdea, f);
  return (await run(stmt.sql, stmt.args)).id;
}
