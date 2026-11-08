"use client";

import { useState } from "react";
import { input, label } from "./ui";

type Option = { id: number; name: string };

/** Fields for adding a person. Parents are only asked for when it's a kid. */
export function PersonFields({
  households,
  adults,
  defaultHouseholdId,
}: {
  households: Option[];
  adults: Option[];
  defaultHouseholdId?: number;
}) {
  const [kind, setKind] = useState<"adult" | "kid">("adult");
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input name="name" required maxLength={60} placeholder="Name" aria-label="Name" className={input} />
        <div className="flex h-11 rounded-lg border border-zinc-300 bg-white p-1 text-sm" role="radiogroup" aria-label="Adult or kid">
          {(["adult", "kid"] as const).map((k) => (
            <label
              key={k}
              className={`flex cursor-pointer items-center rounded-md px-3 font-medium ${kind === k ? "bg-zinc-900 text-white" : "text-zinc-600"}`}
            >
              <input
                type="radio"
                name="kind"
                value={k}
                checked={kind === k}
                onChange={() => setKind(k)}
                className="sr-only"
              />
              {k === "adult" ? "Adult" : "Kid"}
            </label>
          ))}
        </div>
      </div>
      {defaultHouseholdId === undefined ? (
        <select name="household_id" aria-label="Household" className={`${input} appearance-auto`} defaultValue="">
          <option value="">No household</option>
          {households.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      ) : (
        <input type="hidden" name="household_id" value={defaultHouseholdId} />
      )}
      {kind === "kid" && (
        <fieldset>
          <legend className={label}>Parents who manage this list</legend>
          <div className="grid grid-cols-2 gap-1.5 text-[15px]">
            {adults.map((a) => (
              <label key={a.id} className="flex items-center gap-2 py-1">
                <input type="checkbox" name="parents" value={a.id} className="h-4 w-4 accent-zinc-900" />
                {a.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
