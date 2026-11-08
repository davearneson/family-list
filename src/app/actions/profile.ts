"use server";

import { redirect } from "next/navigation";
import { canEditList, getManagerIds, getPerson } from "@/lib/data";
import { now, run } from "@/lib/db";
import { requireViewer } from "@/lib/session";

const text = (fd: FormData, key: string, max: number) =>
  String(fd.get(key) ?? "")
    .trim()
    .slice(0, max) || null;

/** Saves someone's sizes & interests. Only that person, or a parent for a kid. */
export async function saveProfile(fd: FormData) {
  const viewer = await requireViewer();
  const owner = await getPerson(Number(fd.get("person_id")));
  if (!owner) redirect("/");
  const managerIds = owner.is_child ? await getManagerIds(owner.id) : [];
  if (!canEditList(viewer, owner, managerIds)) redirect(`/list/${owner.id}`);

  const shirt = text(fd, "shirt_size", 40);
  const pants = text(fd, "pants_size", 40);
  const shoes = text(fd, "shoe_size", 40);
  const interests = text(fd, "interests", 2000);

  if (!shirt && !pants && !shoes && !interests) {
    await run("DELETE FROM profiles WHERE person_id = ?", [owner.id]);
  } else {
    await run(
      `INSERT INTO profiles (person_id, shirt_size, pants_size, shoe_size, interests, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (person_id) DO UPDATE SET
         shirt_size = excluded.shirt_size, pants_size = excluded.pants_size, shoe_size = excluded.shoe_size,
         interests = excluded.interests, updated_at = excluded.updated_at`,
      [owner.id, shirt, pants, shoes, interests, now()],
    );
  }
  redirect(`/list/${owner.id}`);
}
