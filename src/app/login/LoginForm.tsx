"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { button, input, label } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, { error: null });
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="password" className={label}>
          Family password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          className={input}
        />
      </div>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button className={`${button()} w-full`} disabled={pending}>
        {pending ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}
