import Link from "next/link";
import { notFound } from "next/navigation";
import { removeItem } from "@/app/actions/items";
import { SubmitButton } from "@/components/Buttons";
import { ItemForm } from "@/components/ItemForm";
import { button } from "@/components/ui";
import { canEditItem, getManagerIds, getPerson } from "@/lib/data";
import { get } from "@/lib/db";
import { possessive } from "@/lib/format";
import { requireViewer } from "@/lib/session";
import type { Item } from "@/lib/types";

export default async function EditItemPage({ params }: PageProps<"/item/[id]/edit">) {
  const { id } = await params;
  const viewer = await requireViewer(`/item/${id}/edit`);
  const item = await get<Item>("SELECT * FROM items WHERE id = ? AND removed_at IS NULL", [Number(id)]);
  if (!item) notFound();
  const owner = await getPerson(item.owner_id);
  if (!owner) notFound();
  const managerIds = owner.is_child ? await getManagerIds(owner.id) : [];
  if (!canEditItem(viewer, item, owner, managerIds)) notFound();

  const listName = owner.id === viewer.id ? "my list" : `${possessive(owner.name)} list`;

  return (
    <div>
      <Link href={`/list/${owner.id}`} className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Back to {listName}
      </Link>
      <h1 className="mt-3 mb-6 text-2xl font-semibold tracking-tight">Edit item</h1>
      <ItemForm
        mode="edit"
        itemId={item.id}
        isIdea={!!item.is_idea}
        initial={{
          title: item.title,
          url: item.url ?? "",
          image_url: item.image_url ?? "",
          price: item.price ?? "",
          notes: item.notes ?? "",
          quantity: item.quantity,
          most_wanted: !!item.most_wanted,
        }}
      />
      <form action={removeItem} className="mt-10 border-t border-zinc-200 pt-6">
        <input type="hidden" name="item_id" value={item.id} />
        <SubmitButton className={button("danger", "sm")} confirm={`Remove "${item.title}" from ${listName}?`}>
          Remove from list
        </SubmitButton>
      </form>
    </div>
  );
}
