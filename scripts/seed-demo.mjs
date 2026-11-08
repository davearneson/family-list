// Fills local.db with a made-up demo family so you can click around.
// Usage: npm run seed:demo   (local only — refuses to touch a Turso database)
import { createClient } from "@libsql/client";
import { NUMBER_POSITIONS, SCHEMA, defaultRevealAt } from "../src/lib/schema.ts";

if (process.env.TURSO_DATABASE_URL) {
  console.error("TURSO_DATABASE_URL is set. The demo seed only runs against the local file database.");
  process.exit(1);
}

const url = process.env.DATABASE_URL || "file:local.db";
if (!url.startsWith("file:")) {
  console.error("The demo seed only runs against a local database file.");
  process.exit(1);
}
const db = createClient({ url });
// Drop and recreate (rather than deleting the file) so a running dev server picks up the fresh data.
for (const t of ["claims", "items", "managers", "profiles", "people", "households", "settings"]) {
  await db.execute(`DROP TABLE IF EXISTS ${t}`);
}
await db.batch(SCHEMA, "write");

let t = Date.UTC(2026, 10, 1, 12);
const ts = () => new Date((t += 60_000)).toISOString();
const run = async (sql, args = []) => Number((await db.execute({ sql, args })).lastInsertRowid);

await run("INSERT INTO settings (key, value) VALUES ('reveal_at', ?)", [defaultRevealAt(2026)]);

const household = (name) => run("INSERT INTO households (name, created_at) VALUES (?, ?)", [name, ts()]);
const person = (name, hh, { kid = false, admin = false } = {}) =>
  run("INSERT INTO people (name, household_id, is_child, is_admin, created_at) VALUES (?, ?, ?, ?, ?)", [
    name, hh, kid ? 1 : 0, admin ? 1 : 0, ts(),
  ]);
const manage = (child, ...parents) =>
  Promise.all(parents.map((p) => run("INSERT INTO managers (child_id, manager_id) VALUES (?, ?)", [child, p])));
const item = (owner, title, o = {}) => {
  const c = ts();
  return run(
    `INSERT INTO items (owner_id, added_by, is_idea, title, url, image_url, price, notes, quantity, most_wanted, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [owner, o.by ?? owner, o.idea ? 1 : 0, title, o.url ?? null, o.image ?? null, o.price ?? null, o.notes ?? null,
     o.qty ?? 1, o.wanted ? 1 : 0, c, c],
  );
};
const claim = (itemId, who, status, qty = 1) => {
  const c = ts();
  return run("INSERT INTO claims (item_id, claimer_id, quantity, status, created_at, seen_at) VALUES (?, ?, ?, ?, ?, ?)", [
    itemId, who, qty, status, c, c,
  ]);
};

const parker = await household("Parker family");
const grands = await household("Grandma & Grandpa");
const kate = await household("Kate & Mike");

const dana = await person("Dana", parker, { admin: true });
const sam = await person("Sam", parker);
const emma = await person("Emma", parker, { kid: true });
const leo = await person("Leo", parker, { kid: true });
const jo = await person("Grandma Jo", grands);
const bill = await person("Grandpa Bill", grands);
const k = await person("Kate", kate);
const mike = await person("Mike", kate);
const mia = await person("Mia", kate, { kid: true });
await manage(emma, dana, sam);
await manage(leo, dana, sam);
await manage(mia, k, mike);

// Dana's list
const kindle = await item(dana, "Kindle Paperwhite", { price: "$159.99", wanted: true, url: "https://www.amazon.com/dp/B0CFPJYX7P" });
const skillet = await item(dana, "Cast iron skillet, 12 inch", { price: "$45" });
const socks = await item(dana, "Wool socks", { notes: "Size M, any color", qty: 3, price: "$18" });
await item(dana, "A good mystery novel", { notes: "Anything by Tana French I haven't read" });
// Sam
await item(sam, "Wingspan board game", { price: "$55", wanted: true });
await item(sam, "Running headphones", { price: "$80" });
// Emma (added by her parents)
const lego = await item(emma, "LEGO Friends treehouse", { by: dana, price: "$59.99", wanted: true });
const art = await item(emma, "Art supplies kit", { by: sam, price: "$30" });
await item(emma, "Unicorn pajamas", { by: dana, notes: "Size 7" });
// Leo
await item(leo, "Dinosaur books", { by: sam, qty: 2, notes: "He loves the big picture ones" });
await item(leo, "Balance bike", { by: dana, price: "$90", wanted: true });
// Grandparents, Kate & Mike, Mia
const calendar = await item(jo, "Photo calendar of the grandkids", { wanted: true });
await item(jo, "Gardening gloves", { price: "$20" });
await item(bill, "Fishing lures", { notes: "For bass" });
await item(k, "Yoga mat", { price: "$40" });
await item(k, "A cookbook", { notes: "Something vegetarian" });
await item(mike, "Coffee grinder", { price: "$100", wanted: true });
await item(mia, "Stuffed bunny", { by: k });
await item(mia, "Bubble machine", { by: mike, price: "$25" });

// Secret idea for Dana (Dana must never see it) and a gift idea for Leo
const spa = await item(dana, "Spa day gift card", { by: k, idea: true, price: "$100" });
await item(leo, "Dinosaur pajamas", { by: jo, idea: true, notes: "Size 4T" });

// Claims
await claim(kindle, jo, "reserved");
await claim(skillet, sam, "bought");
await claim(socks, k, "reserved", 2);
await claim(spa, jo, "reserved");
await claim(lego, bill, "bought");
await claim(art, dana, "reserved");
await claim(calendar, dana, "reserved");
await db.execute(NUMBER_POSITIONS);

const profile = (who, shirt, pants, shoes, interests) =>
  run("INSERT INTO profiles (person_id, shirt_size, pants_size, shoe_size, interests, updated_at) VALUES (?, ?, ?, ?, ?, ?)", [
    who, shirt, pants, shoes, interests, ts(),
  ]);
await profile(dana, "M", "8", "8.5", "Gardening, mystery novels, anything for the kitchen. Favorite color is green.\nRing size 6.");
await profile(sam, "L", "34x32", "11", "Coffee, grilling, college football. No more mugs, please!");
await profile(emma, "Kids 10", "Kids 10", "Youth 3", "Unicorns, drawing and LEGO. Just started reading chapter books.");
await profile(jo, null, null, null, "Jigsaw puzzles, birdwatching, tea. Always cold, so anything cozy is a hit.");

console.log(`Demo family ready in ${url.slice(5)}. Family password is in .env.local.`);
