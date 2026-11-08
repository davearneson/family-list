import Link from "next/link";
import { acknowledgeChange, releaseClaim, setClaimStatus } from "@/app/actions/items";
import { SubmitButton } from "@/components/Buttons";
import { Thumb } from "@/components/Thumb";
import { button, card, chip } from "@/components/ui";
import { getShopping, type ShoppingRow } from "@/lib/data";
import { money, possessive, priceNumber } from "@/lib/format";
import { requireViewer } from "@/lib/session";

export default async function ShoppingPage() {
  const viewer = await requireViewer("/shopping");
  const rows = await getShopping(viewer);

  const removed = rows.filter((r) => r.removed_at);
  const active = rows.filter((r) => !r.removed_at);
  const changed = active.filter((r) => r.updated_at > r.seen_at);
  const toBuy = active.filter((r) => r.status === "reserved");
  const bought = active.filter((r) => r.status === "bought");
  const total = active.reduce((sum, r) => sum + (priceNumber(r.price) ?? 0) * r.quantity, 0);

  const byPerson = new Map<number, { name: string; rows: ShoppingRow[] }>();
  for (const r of active) {
    const g = byPerson.get(r.owner_id) ?? { name: r.owner_name, rows: [] };
    g.rows.push(r);
    byPerson.set(r.owner_id, g);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">My shopping</h1>
      <p className="mt-1 text-zinc-500">
        {active.length === 0
          ? "Everything you reserve or buy shows up here."
          : `${toBuy.length} still to buy · ${bought.length} bought${total > 0 ? ` · about ${money(total)}` : ""}`}
      </p>

      {(removed.length > 0 || changed.length > 0) && (
        <section className="mt-6 space-y-2" aria-label="Heads-ups">
          {removed.map((r) => (
            <div key={`r${r.item_id}`} className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-950">
              <p>
                <strong className="font-semibold">&ldquo;{r.title}&rdquo;</strong> was taken off{" "}
                {possessive(r.owner_name)} list after you {r.status === "bought" ? "bought" : "reserved"} it.
                {r.status === "bought" ? " You might keep it as a surprise or return it." : ""}
              </p>
              <form action={releaseClaim} className="mt-2">
                <input type="hidden" name="item_id" value={r.item_id} />
                <SubmitButton className={button("secondary", "sm")}>OK, remove from my shopping</SubmitButton>
              </form>
            </div>
          ))}
          {changed.map((r) => (
            <div key={`c${r.item_id}`} className="rounded-xl border border-sky-200 bg-sky-50 p-3.5 text-sm text-sky-950">
              <p>
                <strong className="font-semibold">&ldquo;{r.title}&rdquo;</strong> was edited after you{" "}
                {r.status === "bought" ? "bought" : "reserved"} it. Double-check the details.
              </p>
              <form action={acknowledgeChange} className="mt-2">
                <input type="hidden" name="item_id" value={r.item_id} />
                <SubmitButton className={button("secondary", "sm")}>Got it</SubmitButton>
              </form>
            </div>
          ))}
        </section>
      )}

      {active.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-zinc-300 px-6 py-10 text-center text-zinc-500">
          <p>Nothing yet. Open someone&rsquo;s list and tap Reserve.</p>
          <Link href="/" className={`${button()} mt-4`}>
            Browse lists
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {[...byPerson.entries()].map(([ownerId, g]) => (
            <section key={ownerId}>
              <h2 className="mb-2 flex items-baseline justify-between">
                <Link href={`/list/${ownerId}`} className="font-semibold hover:underline">
                  For {g.name}
                </Link>
                <span className="text-sm text-zinc-500">
                  {g.rows.filter((r) => r.status === "bought").length}/{g.rows.length} bought
                </span>
              </h2>
              <ul className="space-y-2">
                {g.rows.map((r) => (
                  <li key={r.item_id} className={`${card} flex gap-3 p-3`}>
                    <Thumb src={r.image_url} size="h-14 w-14" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug">
                        {r.url ? (
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {r.title}
                          </a>
                        ) : (
                          r.title
                        )}
                      </p>
                      <p className="mt-0.5 text-sm text-zinc-500">
                        {[r.price, r.quantity > 1 ? `×${r.quantity}` : null, r.is_idea ? "Secret idea" : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {r.notes && <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{r.notes}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={chip[r.status]}>{r.status === "bought" ? "Bought" : "Reserved"}</span>
                        <form action={setClaimStatus}>
                          <input type="hidden" name="item_id" value={r.item_id} />
                          {r.status === "reserved" ? (
                            <SubmitButton name="status" value="bought" className={button("secondary", "sm")}>
                              Mark bought
                            </SubmitButton>
                          ) : (
                            <SubmitButton name="status" value="reserved" className={button("ghost", "sm")}>
                              Not bought yet
                            </SubmitButton>
                          )}
                        </form>
                        {r.status === "reserved" && (
                          <form action={releaseClaim}>
                            <input type="hidden" name="item_id" value={r.item_id} />
                            <SubmitButton className={button("ghost", "sm")}>Release</SubmitButton>
                          </form>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
