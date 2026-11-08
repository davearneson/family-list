import Link from "next/link";
import { claimItem, releaseClaim, setClaimStatus, toggleMostWanted } from "@/app/actions/items";
import { hostOf } from "@/lib/format";
import type { ItemView } from "@/lib/types";
import { SubmitButton } from "./Buttons";
import { Thumb } from "./Thumb";
import { button, card, chip } from "./ui";

type Props = {
  item: ItemView;
  viewerId: number;
  /** True when the viewer owns this list. Claims are then null (or bought-only after the reveal). */
  isOwnerView: boolean;
  editable: boolean;
};

export function ItemCard({ item, viewerId, isOwnerView, editable }: Props) {
  const claims = item.claims;
  const claimed = claims?.reduce((sum, c) => sum + c.quantity, 0) ?? 0;
  const remaining = Math.max(0, item.quantity - claimed);
  const mine = claims?.find((c) => c.claimer_id === viewerId);
  const others = claims?.filter((c) => c.claimer_id !== viewerId) ?? [];
  const taken = !isOwnerView && claims !== null && remaining === 0 && !mine;
  const host = hostOf(item.url);
  const meta = [item.price, item.quantity > 1 ? `Wants ${item.quantity}` : null, host].filter(Boolean);

  return (
    <li className={`${card} p-3.5 ${taken ? "opacity-55" : ""}`}>
      <div className="flex gap-3.5">
        <Thumb src={item.image_url} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium leading-snug text-zinc-900">
              {item.url ? (
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {item.title}
                  <span aria-hidden className="ml-1 text-zinc-400">
                    ↗
                  </span>
                </a>
              ) : (
                item.title
              )}
            </h3>
            {editable && !item.is_idea ? (
              <form action={toggleMostWanted}>
                <input type="hidden" name="item_id" value={item.id} />
                <SubmitButton
                  className={`-mt-1 -mr-1 h-8 w-8 rounded-md text-lg leading-none hover:bg-zinc-100 ${item.most_wanted ? "text-amber-500" : "text-zinc-300"}`}
                >
                  <span title={item.most_wanted ? "Most wanted (tap to unmark)" : "Mark as most wanted"}>★</span>
                </SubmitButton>
              </form>
            ) : null}
          </div>

          {meta.length > 0 && <p className="mt-0.5 text-sm text-zinc-500">{meta.join(" · ")}</p>}
          {item.notes && <p className="mt-1.5 whitespace-pre-line text-sm text-zinc-700">{item.notes}</p>}

          {/* Status chips */}
          <div className="mt-2 flex flex-wrap gap-1.5 empty:hidden">
            {item.most_wanted && !editable ? <span className={chip.wanted}>★ Most wanted</span> : null}
            {item.is_idea && item.added_by_name ? (
              <span className={chip.idea}>
                {item.added_by === viewerId ? "Your idea" : `Idea from ${item.added_by_name}`}
              </span>
            ) : null}
            {isOwnerView
              ? claims?.map((c) => (
                  <span key={c.claimer_id} className={chip.bought}>
                    From {c.claimer_name}
                  </span>
                ))
              : null}
            {!isOwnerView && mine ? (
              <span className={chip[mine.status]}>
                You {mine.status === "bought" ? "bought" : "reserved"} {mine.quantity > 1 ? mine.quantity : "this"}
              </span>
            ) : null}
            {!isOwnerView
              ? others.map((c) => (
                  <span key={c.claimer_id} className={chip[c.status]}>
                    {c.status === "bought" ? "Bought" : "Reserved"} by {c.claimer_name}
                    {c.quantity > 1 ? ` ×${c.quantity}` : ""}
                  </span>
                ))
              : null}
            {!isOwnerView && item.quantity > 1 && claimed > 0 ? (
              <span className={chip.neutral}>
                {claimed} of {item.quantity} taken
              </span>
            ) : null}
          </div>

          {/* Actions */}
          <div className="mt-3 flex flex-wrap items-center gap-2 empty:hidden">
            {!isOwnerView && mine ? (
              <>
                {mine.status === "reserved" ? (
                  <form action={setClaimStatus}>
                    <input type="hidden" name="item_id" value={item.id} />
                    <SubmitButton name="status" value="bought" className={button("secondary", "sm")}>
                      Mark bought
                    </SubmitButton>
                  </form>
                ) : (
                  <form action={setClaimStatus}>
                    <input type="hidden" name="item_id" value={item.id} />
                    <SubmitButton name="status" value="reserved" className={button("ghost", "sm")}>
                      Not bought yet
                    </SubmitButton>
                  </form>
                )}
                {mine.status === "reserved" && (
                  <form action={releaseClaim}>
                    <input type="hidden" name="item_id" value={item.id} />
                    <SubmitButton className={button("ghost", "sm")}>Release</SubmitButton>
                  </form>
                )}
              </>
            ) : null}

            {!isOwnerView && !mine && remaining > 0 ? (
              <form action={claimItem} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="item_id" value={item.id} />
                {remaining > 1 ? (
                  <select
                    name="quantity"
                    aria-label="How many"
                    className="h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm"
                    defaultValue="1"
                  >
                    {Array.from({ length: remaining }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                ) : null}
                <SubmitButton name="status" value="reserved" className={button("primary", "sm")}>
                  Reserve
                </SubmitButton>
                <SubmitButton name="status" value="bought" className={button("secondary", "sm")}>
                  I bought it
                </SubmitButton>
              </form>
            ) : null}

            {editable ? (
              <Link href={`/item/${item.id}/edit`} className={button("ghost", "sm")}>
                Edit
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
