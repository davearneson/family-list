import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { run, usesFileDb } from "@/lib/db";
import { getSession } from "@/lib/session";

/** Admins only: downloads a consistent copy of the whole database (works while the app is running). */
export async function GET() {
  const { viewer } = await getSession();
  if (!viewer?.is_admin) return new Response("Only admins can download backups.", { status: 403 });
  if (!usesFileDb()) {
    return new Response("Backups are for self-hosted copies. Turso keeps its own backups.", { status: 404 });
  }

  const dir = await mkdtemp(path.join(os.tmpdir(), "family-list-backup-"));
  const file = path.join(dir, "backup.db");
  try {
    await run("VACUUM INTO ?", [file]);
    const data = await readFile(file);
    const name = `family-list-backup-${new Date().toISOString().slice(0, 10)}.db`;
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/vnd.sqlite3",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
