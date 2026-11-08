"use client";

import { useActionState } from "react";
import { setupFamily } from "@/app/actions/auth";
import { button, input, label } from "@/components/ui";

export function SetupForm() {
  const [state, action, pending] = useActionState(setupFamily, { error: null });
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="name" className={label}>
          Your name
        </label>
        <input id="name" name="name" required autoFocus autoComplete="given-name" className={input} />
      </div>
      <div>
        <label htmlFor="household" className={label}>
          Your household
        </label>
        <input id="household" name="household" placeholder="e.g. The Smiths" className={input} />
      </div>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button className={`${button()} w-full`} disabled={pending}>
        {pending ? "Setting up…" : "Create family"}
      </button>
    </form>
  );
}
