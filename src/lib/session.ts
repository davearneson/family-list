import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { get } from "./db";
import type { Person } from "./types";

// Login model: one shared family password, then "pick your name".
// The cookie holds a signed person id. Changing FAMILY_PASSWORD logs everyone out.

const COOKIE = "fl_session";
const MAX_AGE = 60 * 60 * 24 * 400; // browsers cap cookies at 400 days

function familyPassword(): string {
  const p = process.env.FAMILY_PASSWORD;
  if (!p) throw new Error("FAMILY_PASSWORD is not set. Add it to .env.local (or your host's settings).");
  return p;
}

const normalize = (s: string) => s.trim().toLowerCase();

function passwordVersion(): string {
  return createHash("sha256").update("fl-pw:" + normalize(familyPassword())).digest("base64url").slice(0, 12);
}

function secret(): string {
  return (
    process.env.SESSION_SECRET ||
    createHash("sha256").update("fl-secret:" + normalize(familyPassword())).digest("hex")
  );
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Case-insensitive so nobody gets stuck on a capital letter. */
export function checkFamilyPassword(input: string): boolean {
  const a = createHash("sha256").update(normalize(input)).digest();
  const b = createHash("sha256").update(normalize(familyPassword())).digest();
  return timingSafeEqual(a, b);
}

/**
 * Was this request made over https? Hosts and tunnels (Vercel, Cloudflare, Tailscale…) say so in
 * x-forwarded-proto. Over plain http (e.g. http://192.168.1.20:3000 at home) browsers drop
 * "secure" cookies, so we only mark the cookie secure when the visitor is actually on https.
 */
async function onHttps(): Promise<boolean> {
  const proto = (await headers()).get("x-forwarded-proto")?.split(",")[0]?.trim();
  return proto === "https";
}

/** personId 0 = knows the family password but hasn't picked a name yet. */
export async function setSession(personId: number) {
  const payload = `${passwordVersion()}.${personId}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: await onHttps(),
    maxAge: MAX_AGE,
    path: "/",
  });
}

async function readSession(): Promise<{ personId: number } | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [pv, pid, sig] = parts;
  const expected = Buffer.from(sign(`${pv}.${pid}`));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  if (pv !== passwordVersion()) return null;
  const personId = Number(pid);
  if (!Number.isInteger(personId) || personId < 0) return null;
  return { personId };
}

export const getSession = cache(async (): Promise<{ family: boolean; viewer: Person | null }> => {
  const s = await readSession();
  if (!s) return { family: false, viewer: null };
  if (s.personId === 0) return { family: true, viewer: null };
  const viewer = await get<Person>("SELECT * FROM people WHERE id = ? AND is_child = 0", [s.personId]);
  return { family: true, viewer: viewer ?? null };
});

/** Only allow redirects to paths on this site. */
export function safeNext(next: unknown): string {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : "/";
}

export async function requireViewer(next = "/"): Promise<Person> {
  const { family, viewer } = await getSession();
  if (!family) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!viewer) redirect(`/who?next=${encodeURIComponent(next)}`);
  return viewer;
}
