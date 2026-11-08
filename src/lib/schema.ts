// Plain SQL so it runs the same on a local SQLite file and on Turso.
// Timestamps are ISO strings written by the app (never CURRENT_TIMESTAMP) so they compare correctly.
export const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS households (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    household_id INTEGER,
    is_child INTEGER NOT NULL DEFAULT 0,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  // Which adults manage which kid's list.
  `CREATE TABLE IF NOT EXISTS managers (
    child_id INTEGER NOT NULL,
    manager_id INTEGER NOT NULL,
    PRIMARY KEY (child_id, manager_id)
  )`,
  // is_idea = added by a gift-giver; hidden from the list owner.
  // removed_at = owner removed it after someone claimed it; kept so the claimer gets a heads-up.
  // position = order on the list, set by the owner. Items and secret ideas are numbered separately,
  // so the owner can't spot gaps left by ideas they aren't allowed to see.
  `CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY,
    owner_id INTEGER NOT NULL,
    added_by INTEGER,
    is_idea INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    url TEXT,
    image_url TEXT,
    price TEXT,
    notes TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    most_wanted INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    removed_at TEXT
  )`,
  // seen_at = last time the claimer saw the item's details (for "details changed" heads-ups).
  `CREATE TABLE IF NOT EXISTS claims (
    id INTEGER PRIMARY KEY,
    item_id INTEGER NOT NULL,
    claimer_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL CHECK (status IN ('reserved', 'bought')),
    created_at TEXT NOT NULL,
    seen_at TEXT NOT NULL,
    UNIQUE (item_id, claimer_id)
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS items_owner ON items (owner_id)`,
  `CREATE INDEX IF NOT EXISTS claims_item ON claims (item_id)`,
  `CREATE INDEX IF NOT EXISTS claims_claimer ON claims (claimer_id)`,
];

/** Numbers every list 1, 2, 3… in its old order (most wanted first, then oldest first). */
export const NUMBER_POSITIONS = `UPDATE items SET position = (
  SELECT rn FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY owner_id, is_idea ORDER BY most_wanted DESC, created_at, id) AS rn
      FROM items
  ) r WHERE r.id = items.id
)`;

/** Dec 26 at midnight US Central (06:00 UTC) of the given year. */
export function defaultRevealAt(year = new Date().getUTCFullYear()): string {
  return new Date(Date.UTC(year, 11, 26, 6, 0, 0)).toISOString();
}
