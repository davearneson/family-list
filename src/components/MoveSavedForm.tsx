"use client";

import { useState } from "react";
import { moveSavedIdea } from "@/app/actions/saved";
import type { Target } from "@/lib/targets";
import { SubmitButton } from "./Buttons";
import { button, input, label } from "./ui";

type Props = { savedId: number; targets: Target[]; defaultTo: number | null; viewerId: number };

export function MoveSavedForm({ savedId, targets, defaultTo, viewerId }: Props) {
  const [to, setTo] = useState<number | null>(defaultTo);
  const target = targets.find((t) => t.id === to);
  const group = (g: Target["group"]) =>
    targets
      .filter((t) => t.group === g)
      .map((t) => (
        <option key={t.id} value={t.id}>
          {t.label}
        </option>
      ));

  return (
    <form action={moveSavedIdea} className="space-y-5">
      <input type="hidden" name="saved_id" value={savedId} />
      <div>
        <label htmlFor="owner_id" className={label}>
          Move to
        </label>
        <select
          id="owner_id"
          name="owner_id"
          required
          value={to ?? ""}
          onChange={(e) => setTo(e.target.value ? Number(e.target.value) : null)}
          className={`${input} appearance-auto`}
        >
          <option value="" disabled>
            Choose a list…
          </option>
          <optgroup label="Lists you manage">{group("mine")}</optgroup>
          <optgroup label="Ideas for someone else">{group("idea")}</optgroup>
        </select>
        {target && (
          <p className={`mt-1.5 text-sm ${target.group === "idea" ? "text-sky-800" : "text-zinc-500"}`}>
            {target.hint}
          </p>
        )}
      </div>

      {target && target.id !== viewerId && (
        <label className="flex items-start gap-2.5 text-[15px]">
          <input type="checkbox" name="reserve" defaultChecked className="mt-0.5 h-5 w-5 shrink-0 accent-zinc-900" />
          <span>
            Reserve it for me
            <span className="block text-sm text-zinc-500">So nobody else buys it too. You can release it later.</span>
          </span>
        </label>
      )}

      <SubmitButton className={`${button()} w-full sm:w-auto`}>Move to list</SubmitButton>
    </form>
  );
}
