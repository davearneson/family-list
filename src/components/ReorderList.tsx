"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { reorderItems } from "@/app/actions/items";
import { SubmitButton } from "./Buttons";
import { Thumb } from "./Thumb";
import { button } from "./ui";

export type ReorderRow = {
  id: number;
  title: string;
  image_url: string | null;
  most_wanted: number;
};

type Props = { ownerId: number; items: ReorderRow[]; cancelHref: string };

function moved<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

/** How close (px) to the top or bottom of the screen a drag has to get before the page scrolls. */
const EDGE = 70;

export function ReorderList({ ownerId, items, cancelHref }: Props) {
  const [order, setOrder] = useState(items);
  const [dragId, setDragId] = useState<number | null>(null);
  const rows = useRef(new Map<number, HTMLLIElement>());
  const orderRef = useRef(order);
  const pointerY = useRef(0);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  // While dragging: the row follows the finger, and the page scrolls near the edges.
  // Listeners are on window because React may move the dragged row's element while it's held.
  useEffect(() => {
    if (dragId == null) return;

    const follow = () => {
      const cur = orderRef.current;
      const y = pointerY.current;
      let to = 0;
      for (const r of cur) {
        if (r.id === dragId) continue;
        const box = rows.current.get(r.id)?.getBoundingClientRect();
        if (box && y > box.top + box.height / 2) to++;
      }
      const from = cur.findIndex((r) => r.id === dragId);
      if (from !== -1 && to !== from) {
        orderRef.current = moved(cur, from, to);
        setOrder(orderRef.current);
      }
    };

    let frame = 0;
    const tick = () => {
      const top = (document.querySelector("header")?.getBoundingClientRect().bottom ?? 0) + EDGE;
      if (pointerY.current < top) window.scrollBy(0, -8);
      else if (pointerY.current > window.innerHeight - EDGE) window.scrollBy(0, 8);
      follow();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const onMove = (e: PointerEvent) => {
      pointerY.current = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      pointerY.current = e.clientY;
      follow();
      setDragId(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragId]);

  const step = (index: number, by: -1 | 1) => setOrder((cur) => moved(cur, index, index + by));

  return (
    <form action={reorderItems}>
      <input type="hidden" name="owner_id" value={ownerId} />
      <input type="hidden" name="order" value={order.map((r) => r.id).join(",")} />

      <ol className={`space-y-2 ${dragId != null ? "select-none" : ""}`}>
        {order.map((r, i) => (
          <li
            key={r.id}
            ref={(el) => {
              if (el) rows.current.set(r.id, el);
              else rows.current.delete(r.id);
            }}
            className={`flex items-center gap-2 rounded-xl border bg-white py-1.5 pr-1.5 pl-1 ${
              dragId === r.id ? "relative z-10 border-zinc-900 shadow-lg" : "border-zinc-200"
            }`}
          >
            <button
              type="button"
              aria-label={`Drag to move ${r.title}`}
              className="flex h-11 w-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-zinc-400 active:cursor-grabbing"
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                pointerY.current = e.clientY;
                setDragId(r.id);
              }}
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden>
                <rect x="3" y="5" width="14" height="2" rx="1" />
                <rect x="3" y="9" width="14" height="2" rx="1" />
                <rect x="3" y="13" width="14" height="2" rx="1" />
              </svg>
            </button>
            <Thumb src={r.image_url} size="h-11 w-11" />
            <span className="line-clamp-2 min-w-0 flex-1 text-[15px] leading-snug text-zinc-900">
              {r.most_wanted ? (
                <span className="mr-1 text-amber-500" title="Most wanted">
                  ★
                </span>
              ) : null}
              {r.title}
            </span>
            <button
              type="button"
              aria-label={`Move ${r.title} up`}
              disabled={i === 0}
              onClick={() => step(i, -1)}
              className="h-10 w-10 shrink-0 rounded-lg text-lg text-zinc-600 hover:bg-zinc-100 disabled:opacity-25"
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`Move ${r.title} down`}
              disabled={i === order.length - 1}
              onClick={() => step(i, 1)}
              className="h-10 w-10 shrink-0 rounded-lg text-lg text-zinc-600 hover:bg-zinc-100 disabled:opacity-25"
            >
              ↓
            </button>
          </li>
        ))}
      </ol>

      <div className="sticky bottom-0 z-20 -mx-4 mt-4 flex justify-end gap-2 border-t border-zinc-200 bg-[#fafaf9]/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <Link href={cancelHref} className={button("ghost")}>
          Cancel
        </Link>
        <SubmitButton className={button()}>Save order</SubmitButton>
      </div>
    </form>
  );
}
