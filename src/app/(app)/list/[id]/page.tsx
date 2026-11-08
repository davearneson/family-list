import Link from "next/link";
import { notFound } from "next/navigation";
import { setManagers } from "@/app/actions/family";
import { SubmitButton } from "@/components/Buttons";
import { ItemCard } from "@/components/ItemCard";
import { ProfileCard } from "@/components/ProfileCard";
import { ReorderList } from "@/components/ReorderList";
import { button } from "@/components/ui";
import { canEditItem, getListView, getPeople, getPerson, getProfile } from "@/lib/data";
import { formatDay, joinNames, possessive } from "@/lib/format";
import { requireViewer } from "@/lib/session";

export default async function ListPage({ params, searchParams }: PageProps<"/list/[id]">) {
  const { id } = await params;
  const { reorder } = await searchParams;
  const viewer = await requireViewer(`/list/${id}`);
  const owner = await getPerson(Number(id));
  if (!owner) notFound();

  const [view, people, profile] = await Promise.all([getListView(viewer, owner), getPeople(), getProfile(owner.id)]);
  const adults = people.filter((p) => !p.is_child);
  const parentNames = view.managerIds.map((mid) => people.find((p) => p.id === mid)?.name).filter(Boolean) as string[];
  const first = owner.name;
  const canEditParents = owner.is_child && (view.manages || viewer.is_admin);

  const title = view.isOwnerView ? "My list" : `${possessive(first)} list`;
  const canReorder = view.canEdit && view.items.length > 1;

  if (canReorder && reorder) {
    const listName = view.isOwnerView ? "my list" : `${possessive(first)} list`;
    return (
      <div>
        <Link href={`/list/${owner.id}`} className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Back to {listName}
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Reorder {listName}</h1>
        <p className="mt-4 rounded-lg bg-zinc-100 px-3.5 py-2.5 text-sm text-zinc-700">
          Hold the <span aria-label="three lines">☰</span> and drag, or tap the arrows. Everyone sees the list in this
          order.
        </p>
        <div className="mt-5">
          <ReorderList
            ownerId={owner.id}
            cancelHref={`/list/${owner.id}`}
            items={view.items.map((i) => ({
              id: i.id,
              title: i.title,
              image_url: i.image_url,
              most_wanted: i.most_wanted,
            }))}
          />
        </div>
      </div>
    );
  }

  let notice: string;
  if (view.isOwnerView && view.revealed) {
    notice = "Christmas is here! You can now see who got you what, so thank-you notes are easy.";
  } else if (view.isOwnerView) {
    notice = `Family can reserve things here without you knowing. You won't see what's reserved or bought, or any secret ideas, until ${formatDay(view.revealAt)}.`;
  } else if (owner.is_child) {
    notice = view.manages
      ? `You manage ${possessive(first)} list. Everyone, including you, can see what's reserved or bought.`
      : `Everyone can see what's reserved or bought on kids' lists, including ${first}'s parents.`;
  } else {
    notice = `${first} can't see what's reserved or bought, or any secret ideas.`;
  }

  const addHref = `/add?for=${owner.id}`;
  const addLabel = view.canEdit ? "Add item" : owner.is_child ? "Suggest a gift idea" : "Add a secret idea";

  const ideasHeading = view.isOwnerView
    ? "Surprise gifts"
    : owner.is_child
      ? "Gift ideas from family"
      : `Secret ideas · ${first} can't see these`;

  return (
    <div>
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← All lists
      </Link>
      <div className="mt-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {owner.is_child ? (
            <p className="mt-0.5 text-sm text-zinc-500">
              {parentNames.length ? `Managed by ${joinNames(parentNames)}` : "No parents assigned yet"}
            </p>
          ) : null}
        </div>
        <Link href={addHref} className={`${button(view.canEdit ? "primary" : "secondary", "sm")} shrink-0`}>
          {addLabel}
        </Link>
      </div>

      <p
        className={`mt-4 rounded-lg px-3.5 py-2.5 text-sm ${
          view.isOwnerView && view.revealed ? "bg-emerald-50 text-emerald-900" : "bg-zinc-100 text-zinc-700"
        }`}
      >
        {notice}
      </p>

      {canEditParents ? (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-zinc-500 hover:text-zinc-900">Change who manages this list</summary>
          <form action={setManagers} className="mt-2 rounded-lg border border-zinc-200 bg-white p-3">
            <input type="hidden" name="child_id" value={owner.id} />
            <div className="grid grid-cols-2 gap-1.5">
              {adults.map((a) => (
                <label key={a.id} className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    name="parents"
                    value={a.id}
                    defaultChecked={view.managerIds.includes(a.id)}
                    className="h-4 w-4 accent-zinc-900"
                  />
                  {a.name}
                </label>
              ))}
            </div>
            <SubmitButton className={`${button("secondary", "sm")} mt-2`}>Save parents</SubmitButton>
          </form>
        </details>
      ) : null}

      <ProfileCard
        profile={profile}
        whose={view.isOwnerView ? "your" : possessive(first)}
        editHref={view.canEdit ? `/list/${owner.id}/about` : null}
      />

      {view.items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-zinc-300 px-6 py-10 text-center text-zinc-500">
          {view.canEdit ? (
            <>
              <p>Nothing here yet.</p>
              <Link href={addHref} className={`${button()} mt-4`}>
                Add the first item
              </Link>
            </>
          ) : (
            <p>{first} hasn&rsquo;t added anything yet.</p>
          )}
        </div>
      ) : (
        <>
          {canReorder ? (
            <div className="mt-4 flex justify-end">
              <Link href={`/list/${owner.id}?reorder=1`} className={button("ghost", "sm")}>
                <span aria-hidden>↕</span> Reorder
              </Link>
            </div>
          ) : null}
          <ul className={`${canReorder ? "mt-2" : "mt-6"} space-y-2.5`}>
            {view.items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                viewerId={viewer.id}
                isOwnerView={view.isOwnerView}
                editable={canEditItem(viewer, item, owner, view.managerIds)}
              />
            ))}
          </ul>
        </>
      )}

      {view.ideas.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">{ideasHeading}</h2>
          <ul className="space-y-2.5">
            {view.ideas.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                viewerId={viewer.id}
                isOwnerView={view.isOwnerView}
                editable={canEditItem(viewer, item, owner, view.managerIds)}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
