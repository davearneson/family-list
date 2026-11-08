"use client";

import { useState } from "react";
import { Logo } from "./Logo";

export function Thumb({ src, size = "h-16 w-16" }: { src: string | null; size?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div className={`${size} flex shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-300`}>
        <Logo className="h-7 w-7" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- images come from any shop's site
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={`${size} shrink-0 rounded-lg border border-zinc-100 bg-white object-contain`}
    />
  );
}
