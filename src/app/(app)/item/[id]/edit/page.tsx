import Link from "next/link";
import { notFound } from "next/navigation";
import { removeItem } from "@/app/actions/items";
import { SubmitButton } from "@/components/Buttons";
import { ItemForm } from "@/components/ItemForm";
import { button } from "@/components/ui";
import { canEditItem, getItemClaims, getManagerIds, getPerson, isItemClaimed } from "@/lib/data";
import { get } from "@/lib/db";
import { joinNames, possessive } from "@/lib/format";
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

  const isOwner = owner.id === viewer.id;
  const listName = isOwner ? "my list" : `${possessive(owner.name)} list`;

  // The owner is only warned that *someone* claimed it, never who (see the exception in lib/data.ts).
  // Everyone else who can edit (a kid's parents, an idea's author) already sees claims, so they get specifics.
  let warning = "";
  if (isOwner) {
    if (await isItemClaimed(item.id)) {
      warning =
        "Heads-up: someone may have already bought this for you. If you remove it, they'll get a note that it was removed.";
    }
  } else {
    const claims = await getItemClaims(item.id);
    if (claims.length > 0) {
      const who = claims.map(
        (c) =>
          `${c.claimer_id === viewer.id ? "you" : c.claimer_name} ${c.status === "bought" ? "already bought it" : "reserved it"}`,
      );
      const text = joinNames(who);
      const others = claims.some((c) => c.claimer_id !== viewer.id);
      warning = `Heads-up: ${text[0].toUpperCase()}${text.slice(1)}.${others ? " They'll get a note that it was removed." : ""}`;
    }
  }
  const confirmText = `Remove "${item.title}" from ${listName}?${warning ? `\n\n${warning}` : ""}`;

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
        <SubmitButton className={button("danger", "sm")} confirm={confirmText}>
          Remove from list
        </SubmitButton>
      </form>
    </div>
  );
}
