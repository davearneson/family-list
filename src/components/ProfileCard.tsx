import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { Profile } from "@/lib/types";
import { button, card } from "./ui";

type Props = {
  profile: Profile | undefined;
  /** "your" or "Emma's" */
  whose: string;
  editHref: string | null;
};

/** Sizes & general interests at the top of a list. Hidden from gift-givers when empty. */
export function ProfileCard({ profile, whose, editHref }: Props) {
  if (!profile) {
    if (!editHref) return null;
    return (
      <Link
        href={editHref}
        className="mt-4 block rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
      >
        <span className="font-medium text-zinc-900">+ Add {whose} sizes & interests</span>
        <br />
        Shirt, pants or dress, and shoe sizes, plus hobbies and general ideas.
      </Link>
    );
  }

  const sizes = [
    ["Shirt", profile.shirt_size],
    ["Pants / dress", profile.pants_size],
    ["Shoes", profile.shoe_size],
  ].filter((s): s is [string, string] => !!s[1]);

  return (
    <section className={`${card} mt-4 px-4 py-3`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Sizes & interests</h2>
        {editHref ? (
          <Link href={editHref} className={`${button("ghost", "sm")} -my-1.5 -mr-2`}>
            Edit
          </Link>
        ) : null}
      </div>
      {sizes.length > 0 ? (
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
          {sizes.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-zinc-500">{k}</dt>
              <dd className="font-medium text-zinc-900">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {profile.interests ? (
        <p className="mt-2.5 whitespace-pre-line text-[15px] text-zinc-700">{profile.interests}</p>
      ) : null}
      <p className="mt-2.5 text-xs text-zinc-400">Updated {formatDate(new Date(profile.updated_at))}</p>
    </section>
  );
}
