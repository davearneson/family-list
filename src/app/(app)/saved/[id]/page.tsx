import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteSavedIdea } from "@/app/actions/saved";
import { SubmitButton } from "@/components/Buttons";
import { ItemForm } from "@/components/ItemForm";
import { button } from "@/components/ui";
import { getPeople, getSavedIdea } from "@/lib/data";
import { requireViewer } from "@/lib/session";

export default async function EditSavedPage({ params }: PageProps<"/saved/[id]">) {
  const { id } = await params;
  const viewer = await requireViewer(`/saved/${id}`);
  const saved = await getSavedIdea(viewer, Number(id));
  if (!saved) notFound();
  const people = await getPeople();

  return (
    <div>
      <Link href="/shopping" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← My shopping
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Edit saved idea</h1>
      <p className="mt-1.5 mb-6 text-sm text-zinc-500">Only you can see this.</p>
      <ItemForm
        mode="saved"
        savedId={saved.id}
        people={people.filter((p) => p.id !== viewer.id).map((p) => ({ id: p.id, name: p.name }))}
        initialFor={saved.for_ids}
        initial={{
          title: saved.title,
          url: saved.url ?? "",
          image_url: saved.image_url ?? "",
          price: saved.price ?? "",
          notes: saved.notes ?? "",
          quantity: 1,
          most_wanted: false,
        }}
      />
      <div className="mt-10 flex flex-wrap gap-2 border-t border-zinc-200 pt-6">
        <Link href={`/saved/${saved.id}/move`} className={button("secondary", "sm")}>
          Move to a list
        </Link>
        <form action={deleteSavedIdea}>
          <input type="hidden" name="saved_id" value={saved.id} />
          <SubmitButton className={button("danger", "sm")} confirm={`Delete "${saved.title}"?`}>
            Delete
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
