"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addItem, previewLink, updateItem } from "@/app/actions/items";
import { Thumb } from "./Thumb";
import { button, input, label, textarea } from "./ui";

export type Target = {
  id: number;
  label: string;
  group: "mine" | "idea";
  /** Shown under the picker so it's clear who will (and won't) see the item. */
  hint: string;
};

export type ItemValues = {
  title: string;
  url: string;
  image_url: string;
  price: string;
  notes: string;
  quantity: number;
  most_wanted: boolean;
};

type Props =
  | { mode: "add"; targets: Target[]; defaultTargetId: number; initial: ItemValues; autoLookup: boolean }
  | { mode: "edit"; itemId: number; isIdea: boolean; initial: ItemValues };

type Lookup = "idle" | "loading" | "done" | "failed";

export function ItemForm(props: Props) {
  const [state, formAction, pending] = useActionState(props.mode === "add" ? addItem : updateItem, { error: null });
  const [url, setUrl] = useState(props.initial.url);
  const [title, setTitle] = useState(props.initial.title);
  const [image, setImage] = useState(props.initial.image_url);
  const [price, setPrice] = useState(props.initial.price);
  const [lookup, setLookup] = useState<Lookup>("idle");
  const [canPaste, setCanPaste] = useState(false);
  const [targetId, setTargetId] = useState(props.mode === "add" ? props.defaultTargetId : 0);
  const lastLooked = useRef("");

  const target = props.mode === "add" ? props.targets.find((t) => t.id === targetId) : undefined;
  const isIdea = props.mode === "edit" ? props.isIdea : target?.group === "idea";

  async function lookUp(raw: string) {
    const text = raw.trim();
    if (!/https?:\/\//i.test(text) || text === lastLooked.current) return;
    lastLooked.current = text;
    setLookup("loading");
    const res = await previewLink(text);
    if (!res.ok) return setLookup("failed");
    lastLooked.current = res.url;
    setUrl(res.url);
    // Only fill in what's still empty, never overwrite what someone typed.
    setTitle((t) => (t.trim() ? t : (res.title ?? "")));
    setImage((i) => (i.trim() ? i : (res.image ?? "")));
    setPrice((p) => (p.trim() ? p : (res.price ?? "")));
    setLookup(res.title || res.image ? "done" : "failed");
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        lookUp(text);
      }
    } catch {
      setCanPaste(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only capability check
    setCanPaste(typeof navigator !== "undefined" && !!navigator.clipboard?.readText);
    if (props.mode === "add" && props.autoLookup && props.initial.url && (!props.initial.title || !props.initial.image_url)) {
      lookUp(props.initial.url);
    }
    // Run once on mount (e.g. arriving from the share sheet or bookmarklet).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <form action={formAction} className="space-y-5">
      {props.mode === "edit" && <input type="hidden" name="item_id" value={props.itemId} />}

      {props.mode === "add" && (
        <div>
          <label htmlFor="owner_id" className={label}>
            Add to
          </label>
          <select
            id="owner_id"
            name="owner_id"
            value={targetId}
            onChange={(e) => setTargetId(Number(e.target.value))}
            className={`${input} appearance-auto`}
          >
            <optgroup label="Lists you manage">
              {props.targets
                .filter((t) => t.group === "mine")
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Ideas for someone else">
              {props.targets
                .filter((t) => t.group === "idea")
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
            </optgroup>
          </select>
          {target && <p className={`mt-1.5 text-sm ${isIdea ? "text-sky-800" : "text-zinc-500"}`}>{target.hint}</p>}
        </div>
      )}

      <div>
        <label htmlFor="url" className={label}>
          Link <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <div className="flex gap-2">
          <input
            id="url"
            name="url"
            type="text"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            placeholder="Paste a link from any website"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              setTimeout(() => lookUp(text), 0);
            }}
            onBlur={(e) => lookUp(e.target.value)}
            className={input}
          />
          {canPaste && (
            <button type="button" onClick={paste} className={`${button("secondary")} shrink-0`}>
              Paste
            </button>
          )}
        </div>
        <p className="mt-1.5 min-h-5 text-sm text-zinc-500" aria-live="polite">
          {lookup === "loading" && "Looking up that page…"}
          {lookup === "done" && "Filled in from the page. Change anything you like."}
          {lookup === "failed" && "Couldn't read that page (some shops block it). Just fill in the details below."}
        </p>
      </div>

      <div className="flex gap-3">
        {image ? <Thumb key={image} src={image} size="h-20 w-20" /> : null}
        <div className="min-w-0 flex-1">
          <label htmlFor="title" className={label}>
            What is it?
          </label>
          <input
            id="title"
            name="title"
            required
            maxLength={200}
            placeholder="e.g. Wool socks, size M"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={input}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="price" className={label}>
            Price <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <input
            id="price"
            name="price"
            maxLength={40}
            placeholder="$25"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="quantity" className={label}>
            How many?
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            max={99}
            defaultValue={props.initial.quantity}
            className={input}
          />
        </div>
      </div>

      <div>
        <label htmlFor="notes" className={label}>
          Notes <span className="font-normal text-zinc-400">(size, color, any details)</span>
        </label>
        <textarea id="notes" name="notes" maxLength={1000} defaultValue={props.initial.notes} className={textarea} />
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-zinc-500 hover:text-zinc-900">Picture link</summary>
        <input
          name="image_url"
          type="text"
          inputMode="url"
          autoCapitalize="off"
          placeholder="https://…/picture.jpg"
          value={image}
          onChange={(e) => setImage(e.target.value)}
          className={`${input} mt-2`}
        />
      </details>

      {!isIdea && (
        <label className="flex items-center gap-2.5 text-[15px]">
          <input
            type="checkbox"
            name="most_wanted"
            defaultChecked={props.initial.most_wanted}
            className="h-5 w-5 accent-amber-500"
          />
          <span>
            <span className="text-amber-500">★</span> Most wanted
          </span>
        </label>
      )}

      {state.error && <p className="text-sm text-red-700">{state.error}</p>}

      <button className={`${button()} w-full sm:w-auto`} disabled={pending}>
        {pending ? "Saving…" : props.mode === "add" ? (isIdea ? "Add idea" : "Add to list") : "Save changes"}
      </button>
    </form>
  );
}
