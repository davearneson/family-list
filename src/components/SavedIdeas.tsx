import Link from "next/link";
import { hostOf, joinNames } from "@/lib/format";
import type { Person, SavedIdea } from "@/lib/types";
import { Thumb } from "./Thumb";
import { button, card } from "./ui";

/** The viewer's private "maybe" pile, at the top of My shopping. */
export function SavedIdeasSection({ ideas, people }: { ideas: SavedIdea[]; people: Person[] }) {
  const nameOf = (id: number) => people.find((p) => p.id === id)?.name;

  return (
    <section className="mt-6 rounded-xl bg-zinc-100 p-3.5" aria-labelledby="saved-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="saved-heading" className="font-semibold">
          Saved ideas
        </h2>
        <Link href="/add?for=0" className={`${button("ghost", "sm")} -my-1 -mr-1.5`}>
          + Save an idea
        </Link>
      </div>
      <p className="mt-0.5 text-sm text-zinc-500">
        Only you can see these. Move one to a list when you decide who it&rsquo;s for.
      </p>

      {ideas.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-600">
          Nothing saved yet. When you spot something but aren&rsquo;t sure who it&rsquo;s for, choose{" "}
          <strong className="font-medium">Save for later</strong> when you add it.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {ideas.map((s) => {
            const names = s.for_ids.map(nameOf).filter((n): n is string => !!n);
            const meta = [s.price, hostOf(s.url)].filter(Boolean).join(" · ");
            return (
              <li key={s.id} className={`${card} flex gap-3 p-3`}>
                <Thumb src={s.image_url} size="h-14 w-14" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {s.title}
                      </a>
                    ) : (
                      s.title
                    )}
                  </p>
                  {meta && <p className="mt-0.5 text-sm text-zinc-500">{meta}</p>}
                  {names.length > 0 && <p className="mt-0.5 text-sm text-zinc-600">Maybe for {joinNames(names)}</p>}
                  {s.notes && <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{s.notes}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link href={`/saved/${s.id}/move`} className={button("secondary", "sm")}>
                      Move to a list
                    </Link>
                    <Link href={`/saved/${s.id}`} className={button("ghost", "sm")}>
                      Edit
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** On someone's list: the viewer's saved ideas tagged for them. Never rendered on your own list. */
export function SavedForPerson({ ideas, ownerId, name }: { ideas: SavedIdea[]; ownerId: number; name: string }) {
  if (ideas.length === 0) return null;
  return (
    <section className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3.5 py-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Your saved ideas for {name} · only you see these
      </h2>
      <ul className="mt-2 space-y-2">
        {ideas.map((s) => (
          <li key={s.id} className="flex items-center gap-3">
            <Thumb src={s.image_url} size="h-10 w-10" />
            <span className="line-clamp-2 min-w-0 flex-1 text-[15px] leading-snug">{s.title}</span>
            <Link href={`/saved/${s.id}/move?to=${ownerId}`} className={`${button("secondary", "sm")} shrink-0`}>
              Move here
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
