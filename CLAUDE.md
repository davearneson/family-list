# Family List: notes for Claude

Read this first. It's the handoff from the sessions that built the app, so you don't have to rediscover how things work.

## What this is

A private Christmas list site for Alex's family: about 10 adults and 5 kids, mostly on iPhones, several of them grandparents. Everyone logs in with one shared family password, then taps their name. People add items to their own list. Others reserve or mark items bought without the list owner ever finding out. Kids don't log in; one or more parents manage each kid's list.

Write UI copy for non-technical, older users: short, plain, friendly, no jargon. Design is clean and minimal.

## Where things live

- **Code:** github.com/davearneson/family-list (public). `main` is the source of truth. There's also an older working copy on Alex's NAS network drive; pull before using it.
- **Commits:** use the repo-local identity `davearneson <16658493+davearneson@users.noreply.github.com>`. Never put Alex's personal email in the public history.
- **Production:** every push to `main` runs `.github/workflows/docker.yml`, which builds `ghcr.io/davearneson/family-list:latest` for amd64 and arm64. It takes about 7 minutes; follow it with `gh run watch <id> --repo davearneson/family-list`. The image runs as the Portainer stack `family-list` on Alex's home Docker server. Data lives in the `family-list-data` volume, and Tailscale Funnel gives it a public https address.
- **Addresses and secrets stay out of the repo, because it's public.** Ask Alex for the site address or the server details if you need them. The real `FAMILY_PASSWORD` is only set in Portainer; never print it.

## Deploying (Alex does the last step)

1. Alex says to commit and push. Don't commit or push without being asked.
2. Watch the GitHub Actions build until it's green.
3. Tell Alex to update the stack in Portainer (Stacks → family-list → Editor → Update the stack, with **re-pull the image** on). If the change touches the database, tell Alex to download a backup first (Family → Download a backup in the app).

## Stack

Next.js 16 (App Router, server actions, Turbopack), React 19, Tailwind CSS v4, libSQL: a SQLite file locally and in Docker, or Turso if hosted on Vercel. Node 24. `output: "standalone"` for Docker.

- `src/lib/data.ts`: every read query, **and the privacy rules** (see below).
- `src/lib/schema.ts` and `src/lib/db.ts`: tables, plus `migrate()` for upgrading existing databases.
- `src/app/actions/*.ts`: server actions (`"use server"`). Shared helpers that must *not* be callable from the browser go in `src/lib/` (`items.ts`, `saved.ts`, `targets.ts`), not in action files.
- `src/lib/session.ts`: the signed cookie `fl_session` (`pv.personId.hmac`). The secret is derived from `FAMILY_PASSWORD`.
- `scripts/seed-demo.mjs`: demo family (Dana, Sam, kids Emma and Leo, Grandma Jo, Grandpa Bill, Kate, Mike, kid Mia). `scripts/check-privacy.mjs`: privacy tests.

## Privacy rules (the whole point of the app)

Enforced on the server in `src/lib/data.ts`, never just hidden in the UI:

1. A list owner never receives claim data (reserved/bought, who) or secret ideas for their own list. Not in the HTML, not in React's data payload.
2. After the reveal date (default Dec 26, set in Family → Settings), owners see *bought* items only, as "From X". Never reservations.
3. Kids don't log in, so every adult, parents included, sees claims on kids' lists.
4. **One deliberate exception, Alex's choice:** when the owner goes to remove an item that someone has claimed, the confirm says "someone may have already bought this". Yes/no only (`isItemClaimed`), never who, never reserved vs bought.
5. **Saved ideas** are private to whoever saved them. Every query filters by the viewer. Others get a 404.
6. **Sizes & interests** (profiles) are meant for everyone. Only the person, or a kid's parents, can edit them.

Other privacy behaviors: claimed items don't move or change on the owner's view. If an owner removes or edits a claimed item, the claimer gets a heads-up on My shopping, and the owner sees nothing different.

## Features and decisions so far

- Reserve / I bought it / Mark bought / Release, with quantities. Gift-givers see who has what ("Reserved by Grandma Jo").
- Secret ideas: a gift-giver adds an idea to someone's list that only other gift-givers see. On kids' lists they're called "gift ideas".
- ★ Most wanted is a badge only. It doesn't sort; the owner orders the list manually.
- Reorder: owners, and parents for kids, drag or tap arrows (`?reorder=1` on the list page). `items.position` is numbered separately for items and ideas, so the owner can't spot gaps left by hidden ideas. Reordering doesn't bump `updated_at`, which would trigger heads-ups.
- Sizes & interests: shirt, pants/dress, shoes, free-text interests (`profiles` table, `/list/[id]/about`).
- Saved ideas: a private "maybe" pile. On the Add form (and so the share shortcut), "Save for later (only me)" is `owner_id=0`. Ideas can be tagged "maybe for" people. They show in My shopping, and in a private box on a tagged person's list ("Move here"). Moving one to someone else's list makes it a secret idea, with "Reserve it for me" ticked by default. Moving it to your own list or a managed kid's list makes a regular item.
- Adding from the web: paste a link (preview via `src/lib/linkPreview.ts`; Amazon works, some shops block it), the computer bookmarklet, Android share target, and an iPhone Shortcut. Alex built the shortcut; its iCloud link is saved in Family → Settings, and the Add from web page shows an install button.
- Don't add more nav tabs; the tab bar already scrolls sideways on iPhone.
- Known gaps: there's no "start fresh for next year" yet. The iPhone Home Screen app and Safari keep separate logins.

## Database changes

- New tables: add `CREATE TABLE IF NOT EXISTS` to `SCHEMA`. They're created automatically on startup.
- New columns on existing tables: also add a check in `migrate()` in `db.ts` (`PRAGMA table_info`, then `ALTER TABLE` and any backfill). The production database must upgrade itself with no manual steps.
- Also update `deletePerson` in `src/app/actions/family.ts` (cascade), the drop list and demo data in `seed-demo.mjs`, and the privacy check if the data is private.

## Testing (do this before saying something works)

```bash
npm install
npx next typegen          # generates PageProps etc. so tsc works in a fresh checkout
npx tsc --noEmit -p . && npx eslint
npm run seed:demo         # resets local.db to the demo family (local file only)
npm run dev               # http://localhost:3000, password "jingle" (from .env.local)
npm run check:privacy     # with the dev server running; must pass
npx next build
```

- `.env.local` is gitignored. In a fresh clone, create it with `FAMILY_PASSWORD=jingle`.
- Test UI at phone size (375×812), since that's how the family uses it.
- To act as different people without the browser, sign a cookie the way `check-privacy.mjs` does (`cookieFor(personId)`). To test that a server action refuses a forged request, post the form's own hidden `$ACTION_ID_…` field to **the page that renders that form**. Next rejects actions posted to other routes, which looks like a refusal but proves nothing. Always include a positive control: the same request should succeed for someone who *is* allowed.
- Formatting: the repo isn't fully Prettier-formatted. Format only new or changed lines (`npx prettier --print-width 120`), and don't reflow unrelated code.

## Working with Alex

- For bigger features, Alex likes to talk the design through first. Propose how it would work and ask the open questions before changing code.
- Explain things in plain language. Alex is comfortable with GitHub and Portainer, and less so with code.
- When a request conflicts with the privacy rules, explain the tradeoff and offer the private alternative. If Alex still wants it, do it, and record it as an exception (like rule 4).
