import Link from "next/link";
import { button, card, chip } from "@/components/ui";
import { getHomeView } from "@/lib/data";
import { joinNames, plural } from "@/lib/format";
import { requireViewer } from "@/lib/session";
import type { Person } from "@/lib/types";

export default async function Home() {
  const viewer = await requireViewer("/");
  const { people, households, managers, stats, reserved, bought } = await getHomeView(viewer);
  const nameOf = (id: number) => people.find((p) => p.id === id)?.name ?? "someone";

  const managed = people.filter((p) => p.is_child && managers[p.id]?.includes(viewer.id));
  const shown = new Set([viewer.id, ...managed.map((p) => p.id)]);
  const others = people.filter((p) => !shown.has(p.id));
  const groups = [
    ...households.map((h) => ({ key: `h${h.id}`, name: h.name, people: others.filter((p) => p.household_id === h.id) })),
    { key: "none", name: "Others", people: others.filter((p) => !households.some((h) => h.id === p.household_id)) },
  ].filter((g) => g.people.length);

  const mine = stats[viewer.id]?.total ?? 0;

  function subtitle(p: Person) {
    const s = stats[p.id];
    if (p.id === viewer.id) return mine ? plural(mine, "item") : "Empty so far";
    if (!s?.total) return "No items yet";
    return `${plural(s.total, "item")} · ${s.available} still available`;
  }

  function renderCard(p: Person, title?: string) {
    const parentIds = managers[p.id] ?? [];
    return (
      <li key={p.id}>
        <Link
          href={`/list/${p.id}`}
          className={`${card} flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:border-zinc-400`}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{title ?? p.name}</span>
              {p.is_child ? <span className={chip.neutral}>Kid</span> : null}
            </div>
            <p className="mt-0.5 truncate text-sm text-zinc-500">
              {subtitle(p)}
              {p.is_child && parentIds.length && !managed.includes(p) ? ` · ${joinNames(parentIds.map(nameOf))}` : ""}
            </p>
          </div>
          <span aria-hidden className="text-zinc-400">
            ›
          </span>
        </Link>
      </li>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Hi, {viewer.name}</h1>
        {reserved + bought > 0 ? (
          <p className="mt-1 text-zinc-500">
            You&rsquo;ve reserved {reserved} and bought {bought}.{" "}
            <Link href="/shopping" className="text-zinc-900 underline underline-offset-2">
              See your shopping
            </Link>
          </p>
        ) : (
          <p className="mt-1 text-zinc-500">Tap anyone&rsquo;s list to reserve a gift. They won&rsquo;t know.</p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Your lists</h2>
        <ul className="space-y-2">
          {renderCard(viewer, "My list")}
          {managed.map((p) => renderCard(p))}
        </ul>
        {mine === 0 && (
          <Link href="/add" className={`${button()} mt-3`}>
            Add your first item
          </Link>
        )}
      </section>

      {groups.map((g) => (
        <section key={g.key}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{g.name}</h2>
          <ul className="space-y-2">
            {g.people.map((p) => renderCard(p))}
          </ul>
        </section>
      ))}

      {people.length === 1 && viewer.is_admin ? (
        <p className="text-zinc-500">
          It&rsquo;s just you so far.{" "}
          <Link href="/family" className="text-zinc-900 underline underline-offset-2">
            Add your family
          </Link>
        </p>
      ) : null}
    </div>
  );
}
