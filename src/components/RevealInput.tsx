"use client";

import { useState } from "react";
import { input } from "./ui";

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** A date/time picker in *your* time zone that submits an exact moment (ISO) to the server. */
export function RevealInput({ iso }: { iso: string }) {
  const [local, setLocal] = useState(() => toLocalInput(new Date(iso)));
  const parsed = new Date(local);
  return (
    <>
      <input
        type="datetime-local"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        aria-label="Reveal date and time"
        className={input}
        suppressHydrationWarning
      />
      <input type="hidden" name="reveal_at" value={isNaN(parsed.getTime()) ? "" : parsed.toISOString()} />
    </>
  );
}
