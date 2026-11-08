"use server";

import { redirect } from "next/navigation";
import { get, now, run } from "@/lib/db";
import { checkFamilyPassword, getSession, safeNext, setSession } from "@/lib/session";
import type { Person } from "@/lib/types";

export type FormState = { error: string | null };

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const password = String(fd.get("password") ?? "");
  const next = safeNext(fd.get("next"));
  if (!checkFamilyPassword(password)) return { error: "That's not the family password. Try again?" };
  await setSession(0);
  redirect(`/who?next=${encodeURIComponent(next)}`);
}

export async function pickPerson(fd: FormData) {
  const { family } = await getSession();
  if (!family) redirect("/login");
  const person = await get<Person>("SELECT * FROM people WHERE id = ? AND is_child = 0", [Number(fd.get("person_id"))]);
  if (!person) redirect("/who");
  await setSession(person.id);
  redirect(safeNext(fd.get("next")));
}

/** First-run: the first person to log in becomes the admin. */
export async function setupFamily(_: FormState, fd: FormData): Promise<FormState> {
  const { family } = await getSession();
  if (!family) redirect("/login");
  const name = String(fd.get("name") ?? "").trim().slice(0, 60);
  const household = String(fd.get("household") ?? "").trim().slice(0, 60);
  if (!name) return { error: "What's your name?" };
  const existing = await get<{ n: number }>("SELECT COUNT(*) AS n FROM people WHERE is_child = 0");
  if (existing && existing.n > 0) redirect("/who");
  const t = now();
  const h = await run("INSERT INTO households (name, created_at) VALUES (?, ?)", [household || `${name}'s family`, t]);
  const p = await run(
    "INSERT INTO people (name, household_id, is_child, is_admin, created_at) VALUES (?, ?, 0, 1, ?)",
    [name, h.id, t],
  );
  await setSession(p.id);
  redirect("/family");
}

export async function switchPerson() {
  await setSession(0);
  redirect("/who");
}
