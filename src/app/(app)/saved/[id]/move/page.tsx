import Link from "next/link";
import { notFound } from "next/navigation";
import { MoveSavedForm } from "@/components/MoveSavedForm";
import { Thumb } from "@/components/Thumb";
import { card } from "@/components/ui";
import { getManagerMap, getPeople, getSavedIdea } from "@/lib/data";
import { hostOf } from "@/lib/format";
import { requireViewer } from "@/lib/session";
import { listTargets } from "@/lib/targets";

export default async function MoveSavedPage({ params, searchParams }: PageProps<"/saved/[id]/move">) {
  const { id } = await params;
  const { to } = await searchParams;
  const viewer = await requireViewer(`/saved/${id}/move`);
  const saved = await getSavedIdea(viewer, Number(id));
  if (!saved) notFound();

  const [people, managers] = await Promise.all([getPeople(), getManagerMap()]);
  const targets = listTargets(viewer, people, managers);
  const valid = (n: number) => targets.some((t) => t.id === n);
  // Preselect: the list you came from, else the first "maybe for", else nothing.
  const defaultTo = valid(Number(to)) ? Number(to) : (saved.for_ids.find(valid) ?? null);
  const meta = [saved.price, hostOf(saved.url)].filter(Boolean).join(" · ");

  return (
    <div>
      <Link href="/shopping" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← My shopping
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Move to a list</h1>

      <div className={`${card} mt-5 flex items-center gap-3 p-3`}>
        <Thumb src={saved.image_url} size="h-12 w-12" />
        <div className="min-w-0">
          <p className="line-clamp-2 font-medium leading-snug">{saved.title}</p>
          {meta && <p className="text-sm text-zinc-500">{meta}</p>}
        </div>
      </div>

      <div className="mt-6">
        <MoveSavedForm savedId={saved.id} targets={targets} defaultTo={defaultTo} viewerId={viewer.id} />
      </div>
    </div>
  );
}
