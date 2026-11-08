import Link from "next/link";
import { notFound } from "next/navigation";
import { saveProfile } from "@/app/actions/profile";
import { SubmitButton } from "@/components/Buttons";
import { button, input, label, textarea } from "@/components/ui";
import { canEditList, getManagerIds, getPerson, getProfile } from "@/lib/data";
import { possessive } from "@/lib/format";
import { requireViewer } from "@/lib/session";

const SIZES = [
  { name: "shirt_size", label: "Shirt", placeholder: "e.g. M" },
  { name: "pants_size", label: "Pants / dress", placeholder: "e.g. 32x30" },
  { name: "shoe_size", label: "Shoes", placeholder: "e.g. 9.5" },
] as const;

export default async function EditProfilePage({ params }: PageProps<"/list/[id]/about">) {
  const { id } = await params;
  const viewer = await requireViewer(`/list/${id}/about`);
  const owner = await getPerson(Number(id));
  if (!owner) notFound();
  const managerIds = owner.is_child ? await getManagerIds(owner.id) : [];
  if (!canEditList(viewer, owner, managerIds)) notFound();
  const profile = await getProfile(owner.id);

  const mine = owner.id === viewer.id;
  const backHref = `/list/${owner.id}`;

  return (
    <div>
      <Link href={backHref} className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Back to {mine ? "my list" : `${possessive(owner.name)} list`}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        {mine ? "My" : possessive(owner.name)} sizes & interests
      </h1>
      <p className="mt-1.5 text-sm text-zinc-500">
        Shown at the top of {mine ? "your" : "the"} list for anyone shopping.
        {owner.is_child ? " Kids grow fast, so update it when sizes change." : " Everything is optional."}
      </p>

      <form action={saveProfile} className="mt-6 space-y-5">
        <input type="hidden" name="person_id" value={owner.id} />
        <div className="grid grid-cols-3 gap-3">
          {SIZES.map((s) => (
            <div key={s.name}>
              <label htmlFor={s.name} className={label}>
                {s.label}
              </label>
              <input
                id={s.name}
                name={s.name}
                maxLength={40}
                placeholder={s.placeholder}
                defaultValue={profile?.[s.name] ?? ""}
                className={input}
              />
            </div>
          ))}
        </div>
        <div>
          <label htmlFor="interests" className={label}>
            Interests & ideas
          </label>
          <textarea
            id="interests"
            name="interests"
            rows={6}
            maxLength={2000}
            defaultValue={profile?.interests ?? ""}
            placeholder="Hobbies, favorite colors or stores, other sizes, books or shows you like, things you don't need…"
            className={textarea}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Link href={backHref} className={button("ghost")}>
            Cancel
          </Link>
          <SubmitButton className={button()}>Save</SubmitButton>
        </div>
      </form>
    </div>
  );
}
