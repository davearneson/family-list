import { createClient, type Client, type InValue } from "@libsql/client";
import { SCHEMA, defaultRevealAt } from "./schema";

type GlobalDb = { __flClient?: Client; __flReady?: Promise<void> };
const g = globalThis as unknown as GlobalDb;

const DB_URL = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "file:local.db";

/** True for a database file on this machine (Docker / local), false for Turso. */
export const usesFileDb = () => DB_URL.startsWith("file:");

function makeClient(): Client {
  return createClient({ url: DB_URL, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
}

const client: Client = g.__flClient ?? (g.__flClient = makeClient());

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
      .then(() => undefined)
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
