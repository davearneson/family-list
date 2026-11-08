import { createClient, type Client, type InValue } from "@libsql/client";
import { NUMBER_POSITIONS, SCHEMA, defaultRevealAt } from "./schema";

type GlobalDb = { __flClient?: Client; __flReady?: Promise<void> };
const g = globalThis as unknown as GlobalDb;

const DB_URL = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "file:local.db";

/** True for a database file on this machine (Docker / local), false for Turso. */
export const usesFileDb = () => DB_URL.startsWith("file:");

function makeClient(): Client {
  return createClient({ url: DB_URL, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
}

const client: Client = g.__flClient ?? (g.__flClient = makeClient());

/** Brings databases made by older versions up to date. Safe to run every startup. */
async function migrate(): Promise<void> {
  const cols = await client.execute("PRAGMA table_info(items)");
  if (!cols.rows.some((r) => r.name === "position")) {
    try {
      // Numbering keeps every list in the order it already had.
      await client.batch(["ALTER TABLE items ADD COLUMN position INTEGER NOT NULL DEFAULT 0", NUMBER_POSITIONS], "write");
    } catch (err) {
      // Another server process may have just done it.
      if (!String(err).includes("duplicate column")) throw err;
    }
  }
}

/** Creates tables on first use, once per server process. */
function ready(): Promise<void> {
  if (!g.__flReady) {
    g.__flReady = client
      .batch(
        [
          ...SCHEMA,
          {
            sql: "INSERT OR IGNORE INTO settings (key, value) VALUES ('reveal_at', ?)",
            args: [defaultRevealAt()],
          },
        ],
        "write",
      )
      .then(migrate)
      .catch((err) => {
        g.__flReady = undefined;
        throw err;
      });
  }
  return g.__flReady;
}

export type Stmt = { sql: string; args?: InValue[] };

export async function all<T>(sql: string, args: InValue[] = []): Promise<T[]> {
  await ready();
  const res = await client.execute({ sql, args });
  // Convert to plain objects so rows are safe to pass around and serialize.
  return res.rows.map((row) => Object.fromEntries(res.columns.map((c, i) => [c, row[i]])) as T);
}

export async function get<T>(sql: string, args: InValue[] = []): Promise<T | undefined> {
  return (await all<T>(sql, args))[0];
}

export async function run(sql: string, args: InValue[] = []) {
  await ready();
  const res = await client.execute({ sql, args });
  return {
    changes: res.rowsAffected,
    id: res.lastInsertRowid != null ? Number(res.lastInsertRowid) : 0,
  };
}

/** Runs several statements in one transaction. */
export async function batch(stmts: Stmt[]) {
  await ready();
  await client.batch(
    stmts.map((s) => ({ sql: s.sql, args: s.args ?? [] })),
    "write",
  );
}

export const now = () => new Date().toISOString();
