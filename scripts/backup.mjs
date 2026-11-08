// Makes a safe copy of the database, even while the app is running.
//   Docker:  docker exec family-list node scripts/backup.mjs   (or use Family → Download a backup)
//   Locally: node scripts/backup.mjs
// The copy goes in a "backups" folder next to the database file.
import { createClient } from "@libsql/client";
import { mkdirSync } from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL || "file:local.db";
if (!url.startsWith("file:")) {
  console.error("This backs up a database file. If you use Turso, it keeps its own backups.");
  process.exit(1);
}

const file = url.slice("file:".length);
const dir = path.join(path.dirname(file), "backups");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const out = path.join(dir, `family-list-${stamp}.db`);

const db = createClient({ url });
await db.execute({ sql: "VACUUM INTO ?", args: [out] });
console.log(`Backed up to ${out}`);
