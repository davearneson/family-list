# Family List

A private Christmas list site for the family.

- Everyone has a list. Kids' lists are run by one or more parents.
- Anyone can **reserve** or mark **bought** on someone else's list, and the list owner never finds out.
- Gift-givers can see who has what ("Reserved by Grandma Jo"), so nothing gets bought twice.
- **Reorder your list** (drag, or tap the arrows) so the things you want most are on top. Parents can reorder their kids' lists.
- **Sizes & interests:** shirt, pants or dress, and shoe sizes, plus hobbies and general ideas that are too vague for the list.
- **Secret ideas:** add gift ideas to someone's list that only the other gift-givers can see.
- **Christmas reveal:** from Dec 26, people can see who gave them what, which helps with thank-you notes.
- **Add from any site:** paste a link and the name, picture and price fill in. You can also use the iPhone Share button, or a bookmark button on a computer.

Cost: **$0**. There are two ways to run it. Pick one:

- **[Option A: Vercel + Turso](#option-a-vercel--turso-about-20-minutes)**. Free hosted services. Nothing to keep running at home.
- **[Option B: Portainer on your own server](#option-b-host-it-yourself-with-portainer)**. One container on a machine you already run. GitHub builds the image for free, and a free Tailscale tunnel gives it an https address.

---

## Option A: Vercel + Turso (about 20 minutes)

You'll need free accounts on **GitHub**, **Turso** and **Vercel**. Turso and Vercel both let you sign up with GitHub.

### 1. Create the database (Turso)

1. Go to <https://turso.tech> and sign up (Continue with GitHub is fine). Stay on the free plan.
2. Create a database named `family-list`. If it asks for a location, pick **AWS US East (Virginia)**, since that's where Vercel runs by default.
3. Open the database and copy its **URL**. It looks like `libsql://family-list-yourname.turso.io`.
4. Click **Create Token** (read & write) and copy the token. Keep it private, like a password.

### 2. Put the code on GitHub

1. On <https://github.com/new>, create a **private** repository called `family-list`. Don't add a README.
2. In this folder, run:

```bash
git init
git add .
git commit -m "Family List"
git branch -M main
git remote add origin https://github.com/davearneson/family-list.git
git push -u origin main
```

`.env.local` and the local database are excluded automatically, so no passwords end up on GitHub.

### 3. Deploy on Vercel

1. Go to <https://vercel.com>, sign up with GitHub, and choose the **Hobby** (free) plan.
2. Click **Add New → Project** and import `family-list`.
3. Before you click Deploy, open **Environment Variables** and add these:

   | Name | Value |
   | --- | --- |
   | `FAMILY_PASSWORD` | The password the family will type. It's not case-sensitive. Pick something easy to say out loud but hard to guess. |
   | `TURSO_DATABASE_URL` | The `libsql://…` URL from step 1 |
   | `TURSO_AUTH_TOKEN` | The token from step 1 |
   | `APP_TIMEZONE` *(optional)* | Defaults to `America/Chicago`. Only affects how the reveal date is displayed. |

4. Click **Deploy**. You'll get an address like `https://family-list-abc123.vercel.app`. For a nicer one, go to **Settings → Domains** and change it to something like `ourfamilylist.vercel.app` (free).

> Vercel's free plan is for personal, non-commercial use, which this is. If the site ever went over its free limits it would pause rather than send you a bill. A family list won't come close.

Then go to [Set it up](#set-it-up).

---

## Option B: Host it yourself with Portainer

**How it fits together:** every time the code changes on GitHub, GitHub builds it into a Docker image for free. Portainer on your server downloads that image and runs it. A free Tailscale tunnel gives it a public `https://` address.

**You need:** your server running Portainer, a GitHub account, and a free Tailscale account. Servers with Intel/AMD and ARM chips (like a Raspberry Pi) both work.

Keep in mind: if the server is off or your internet is down, the list is down too. You're also in charge of backups (one click, see below).

### 1. Put the code on GitHub

Follow [Option A, step 2](#2-put-the-code-on-github).

**Public or private?** The code contains no passwords and no family data; those live only on your server. A public repo is the simplest choice. Private works too, with one extra step below.

Pushing starts the build. Open your repo on GitHub, go to the **Actions** tab, and you'll see **Build Docker image** running. The first run takes about 10–15 minutes. When it shows a green check, your image is ready at `ghcr.io/davearneson/family-list:latest`.

### 2. Let Portainer download the image

GitHub publishes new images as private. Pick one:

- **Make the image public (easiest):** on GitHub, go to your profile → **Packages** → `family-list` → **Package settings** → **Change visibility** → **Public**.
- **Keep it private:** on GitHub, go to **Settings → Developer settings → Personal access tokens → Tokens (classic)** and create a token with only the `read:packages` box ticked. In Portainer, go to **Registries → Add registry → Custom registry**. Enter `ghcr.io` as the URL, your GitHub username, and the token as the password.

### 3. Create the stack in Portainer

1. Go to **Stacks → Add stack** and name it `family-list`.
2. Choose **Web editor** and paste in the contents of [`docker-compose.yml`](docker-compose.yml). Its `image:` line already points to `ghcr.io/davearneson/family-list:latest`.
3. Under **Environment variables**, add `FAMILY_PASSWORD` with the password the family will use. If something else on your server already uses port 3000, also add `HOST_PORT` with a free port, like `3080`.
4. Click **Deploy the stack**.
5. From a device on your home Wi-Fi, open `http://SERVER-IP:3000`. You should see the Family List password screen. **Don't log in yet:** the first person to log in becomes the admin, so do that from the https address once it's working.

### 4. Give it an https address (Tailscale Funnel)

Tailscale runs on the server itself, not inside Portainer. If your server is a NAS, check its app store for a Tailscale package.

1. Install Tailscale on the server from <https://tailscale.com/download> and sign in.
2. Optional: in the Tailscale admin console, rename the server to something like `familylist`. The name becomes part of the address.
3. On the server, run this (use your `HOST_PORT` instead of 3000 if you changed it):

   ```bash
   sudo tailscale funnel --bg 3000
   ```

   The first time, it prints a link to turn on HTTPS and Funnel for your account. Open it, approve, then run the command again. It prints your public address, something like `https://familylist.tail1234.ts.net`. Your family doesn't need Tailscale to open it.
4. In Portainer, go to **Stacks → family-list → Editor** and add an environment variable `PUBLIC_URL` set to that address. Click **Update the stack**. This makes the iPhone shortcut and computer bookmark instructions point to the right place.

If you own a domain on Cloudflare, **Cloudflare Tunnel** works too: point a hostname at `http://SERVER-IP:3000`.

Always use the https address, including at home. Logins are remembered per address, so the IP address and the https address count as two separate logins.

### Updating

After you push a change to GitHub, wait for the Actions build to finish (green check). Then in Portainer, go to **Stacks → family-list → Editor**, click **Update the stack**, and turn on the option to **re-pull the image**. The lists live in the `family-list-data` volume and aren't touched by updates.

### Backups

As the admin, go to **Family → Download a backup**. You get a `family-list-backup-DATE.db` file containing every person, list and reservation. Download one now and then, especially in December, and keep it somewhere off the server.

To restore one (hopefully never), copy the backup file to the server and run these from the folder it's in. Change the file name to yours. The volume name is shown under **Volumes** in Portainer: `family-list_family-list-data` for a stack named `family-list`.

```bash
docker stop family-list
```

```bash
docker run --rm -v family-list_family-list-data:/data -v "$PWD":/backup alpine sh -c "cp /backup/family-list-backup-2026-12-01.db /data/family-list.db && rm -f /data/family-list.db-wal /data/family-list.db-shm && chown 1000:1000 /data/family-list.db"
```

```bash
docker start family-list
```

### Without Portainer

The same file works with plain Docker. Copy `.env.docker.example` to `.env`, fill it in, then run `docker compose up -d`. To build on the server instead of using GitHub's image, run `docker build -t family-list .` and change the `image:` line to `family-list`.

Then go to [Set it up](#set-it-up).

---

## Set it up

1. Open your new site, enter the family password, and type your name. Whoever logs in first becomes the **admin**.
2. Go to **Family** and add households, adults and kids. For each kid, tick the parents who manage their list.
3. Optional: in **Family → Settings**, change the reveal date (default: Dec 26 at midnight Central).
4. Set up the one-tap iPhone shortcut. Go to **Add from web** on your iPhone, follow the six steps (about 3 minutes), then paste the shortcut's iCloud link into **Family → Settings**. After that, everyone else gets a one-tap install button.

## Invite everyone

Text the family something like:

> 🎄 Our Christmas lists are at **https://ourfamilylist.vercel.app**, password **xxxxx**. Pick your name, add what you'd like, and reserve gifts for others (they won't see!). On iPhone: open it in Safari → Share → Add to Home Screen.

---

## Good to know

- **The password is the only lock.** Anyone with the family password can pick any name. That keeps things simple for grandparents, but it also means a curious person could log in as someone else to peek. Only share the password with family. Changing `FAMILY_PASSWORD` logs everyone out. On Vercel, change it in settings and **Redeploy**. With Portainer, change it under the stack's environment variables and **Update the stack**.
- **Some shops block automatic lookups.** Amazon worked in testing. Target, Etsy and REI did not. When a shop blocks it, the name is guessed from the link and you add the picture or price yourself. On a computer, the bookmark button reads the page directly, so it gets everything.
- **iPhone keeps two logins.** The Home Screen app and Safari don't share logins. The share shortcut opens Safari, so you log in there once too.
- **Next year:** there's no "start fresh for next year" button yet. After the reveal, everyone can see who gave them what. Before next season, old lists will need clearing.

## How the secrecy works

The privacy rules are all in [`src/lib/data.ts`](src/lib/data.ts) and enforced on the server:

- When you look at your own list, the server never loads or sends reservations or secret ideas. They aren't just hidden on screen. They never reach your phone, so you can't find them with browser tricks either.
- Claimed items don't move or change on the owner's view, and there's no "3 of 8 claimed" counter.
- If an owner removes or edits an item someone already claimed, the person who claimed it gets a heads-up on **My shopping**. The owner sees nothing different.
- Kids don't log in, so all the grown-ups (parents included) can see claims on kids' lists.

`npm run check:privacy` logs in as every adult and checks that no page leaks anything about their own list. That includes before and after the reveal date.

## Working on it locally

```bash
npm install
```

```bash
npm run seed:demo
```

```bash
npm run dev
```

Open <http://localhost:3000>. The local password is in `.env.local` (`jingle`). The demo family lives in `local.db`, which is separate from the real one. With the dev server running, `npm run check:privacy` runs the privacy check.

Built with Next.js 16, Tailwind CSS and SQLite (via libSQL/Turso).
