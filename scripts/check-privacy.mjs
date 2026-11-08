// Logs in as every grown-up and checks the raw HTML (including the data React sends along)
// never leaks claims or secret ideas about their own list.
// Usage: start the app (npm run dev), then: npm run check:privacy
import { createHash, createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const env = existsSync(".env.local")
  ? Object.fromEntries(
      readFileSync(".env.local", "utf8")
        .split("\n")
        .filter((l) => /^\w+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
    )
  : {};
const pw = String(process.env.FAMILY_PASSWORD || env.FAMILY_PASSWORD || "").trim().toLowerCase();
if (!pw) throw new Error("FAMILY_PASSWORD not found");
const pv = createHash("sha256").update("fl-pw:" + pw).digest("base64url").slice(0, 12);
const secret = env.SESSION_SECRET || createHash("sha256").update("fl-secret:" + pw).digest("hex");
const cookieFor = (id) => {
  const p = `${pv}.${id}`;
  return `fl_session=${p}.${createHmac("sha256", secret).update(p).digest("base64url")}`;
};

const db = createClient({ url: process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "file:local.db", authToken: process.env.TURSO_AUTH_TOKEN });
const rows = async (sql, args = []) => (await db.execute({ sql, args })).rows;

async function page(personId, path) {
  const r = await fetch(BASE + path, { headers: { cookie: cookieFor(personId) }, redirect: "manual" });
  const raw = await r.text();
  // React separates adjacent text with <!-- --> markers; drop them so phrases read naturally.
  return { status: r.status, raw, html: raw.replace(/<!--.*?-->/g, "") };
}

let passed = 0;
const failures = [];
function check(ok, msg) {
  if (ok) passed++;
  else failures.push(msg);
}

// Phrases that only ever appear when claim info is rendered.
const CLAIM_PHRASES = ["Reserved by", "Bought by", "You reserved", "You bought", " taken", "Idea from", "Your idea", "Secret idea"];
// Raw claim statuses as data (e.g. inside React's page payload or a button value).
const RAW_TOKENS = ['"reserved"', '"bought"', '"Reserved"', '"Bought"', "claimer"];
const leaks = (res, extra = []) => [
  ...[...CLAIM_PHRASES, ...extra].filter((p) => res.html.includes(p)),
  ...RAW_TOKENS.filter((t) => res.raw.includes(t)),
];

const adults = await rows("SELECT id, name FROM people WHERE is_child = 0");
const kids = await rows("SELECT id, name FROM people WHERE is_child = 1");
const [{ value: originalReveal }] = await rows("SELECT value FROM settings WHERE key = 'reveal_at'");

async function ownerChecks(label) {
  for (const a of adults) {
    const ideas = (await rows("SELECT title FROM items WHERE owner_id = ? AND is_idea = 1", [a.id])).map((r) => r.title);
    const items = await rows("SELECT id FROM items WHERE owner_id = ? AND is_idea = 0 AND removed_at IS NULL", [a.id]);

    const list = await page(a.id, `/list/${a.id}`);
    check(list.status === 200, `${label}: ${a.name} /list status ${list.status}`);
    const l = leaks(list, ideas);
    check(l.length === 0, `${label}: ${a.name}'s own list leaks: ${l.join(", ")}`);
    check(!list.html.includes("From "), `${label}: ${a.name}'s own list shows "From" before reveal`);

    const reorder = await page(a.id, `/list/${a.id}?reorder=1`);
    const r = leaks(reorder, ideas);
    check(r.length === 0, `${label}: ${a.name}'s reorder screen leaks: ${r.join(", ")}`);

    for (const it of items) {
      const edit = await page(a.id, `/item/${it.id}/edit`);
      const e = leaks(edit, ideas);
      check(e.length === 0, `${label}: ${a.name} edit item ${it.id} leaks: ${e.join(", ")}`);
    }

    const home = await page(a.id, "/");
    const myCard = home.html.slice(home.html.indexOf("My list"), home.html.indexOf("</li>", home.html.indexOf("My list")));
    check(!myCard.includes("available"), `${label}: ${a.name}'s home card shows availability`);

    const add = await page(a.id, "/add");
    const ad = ideas.filter((t) => add.html.includes(t));
    check(ad.length === 0, `${label}: ${a.name} /add leaks idea titles: ${ad.join(", ")}`);
  }
}

try {
  // 1. Before the reveal: owners see nothing.
  await db.execute({ sql: "UPDATE settings SET value = ? WHERE key = 'reveal_at'", args: ["2999-12-26T06:00:00.000Z"] });
  await ownerChecks("before reveal");

  // 2. Positive controls: someone else DOES see claims; parents DO see claims on kids' lists.
  for (const a of adults) {
    const otherClaims = await rows(
      "SELECT COUNT(*) AS n FROM claims c JOIN items i ON i.id = c.item_id WHERE i.owner_id = ? AND c.claimer_id != ? AND i.removed_at IS NULL",
      [a.id, a.id],
    );
    const viewer = adults.find((b) => b.id !== a.id);
    if (otherClaims[0].n > 0 && viewer) {
      const html = (await page(viewer.id, `/list/${a.id}`)).html;
      check(/Reserved by|Bought by|You reserved|You bought/.test(html), `control: ${viewer.name} can't see claims on ${a.name}'s list`);
    }
  }
  for (const k of kids) {
    const [m] = await rows("SELECT manager_id FROM managers WHERE child_id = ? LIMIT 1", [k.id]);
    const [c] = await rows("SELECT COUNT(*) AS n FROM claims c JOIN items i ON i.id = c.item_id WHERE i.owner_id = ? AND i.removed_at IS NULL", [k.id]);
    if (m && c.n > 0) {
      const html = (await page(m.manager_id, `/list/${k.id}`)).html;
      check(/Reserved by|Bought by|You reserved|You bought/.test(html), `control: parent can't see claims on ${k.name}'s list`);
    }
  }

  // 3. After the reveal: owners see "From X" for bought items only — never reservations.
  await db.execute({ sql: "UPDATE settings SET value = ? WHERE key = 'reveal_at'", args: ["2000-01-01T00:00:00.000Z"] });
  for (const a of adults) {
    const reservedOnlyIdeas = (
      await rows(
        "SELECT title FROM items i WHERE owner_id = ? AND is_idea = 1 AND NOT EXISTS (SELECT 1 FROM claims c WHERE c.item_id = i.id AND c.status = 'bought')",
        [a.id],
      )
    ).map((r) => r.title);
    const bought = await rows(
      "SELECT p.name FROM claims c JOIN items i ON i.id = c.item_id JOIN people p ON p.id = c.claimer_id WHERE i.owner_id = ? AND c.status = 'bought' AND i.removed_at IS NULL",
      [a.id],
    );
    const res = await page(a.id, `/list/${a.id}`);
    const html = res.html;
    const l = leaks({ html, raw: "" }, reservedOnlyIdeas).filter((p) => p !== "Idea from" && p !== "Bought by");
    check(l.length === 0, `after reveal: ${a.name} sees reservations/unbought ideas: ${l.join(", ")}`);
    check(!html.includes("Reserved by"), `after reveal: ${a.name} sees "Reserved by"`);
    for (const b of bought) check(html.includes(`From ${b.name}`), `after reveal: ${a.name} missing "From ${b.name}"`);
  }
} finally {
  await db.execute({ sql: "UPDATE settings SET value = ? WHERE key = 'reveal_at'", args: [originalReveal] });
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} privacy problem(s):\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
}
console.log(`✓ ${passed} privacy checks passed for ${adults.length} adults and ${kids.length} kids.`);
