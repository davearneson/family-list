"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "Lists", active: pathname === "/" || pathname.startsWith("/list") || pathname.startsWith("/item") },
    { href: "/shopping", label: "My shopping", active: pathname.startsWith("/shopping") },
    { href: "/add", label: "Add item", active: pathname.startsWith("/add") },
    { href: "/help", label: "Add from web", active: pathname.startsWith("/help") },
    ...(isAdmin ? [{ href: "/family", label: "Family", active: pathname.startsWith("/family") }] : []),
  ];
  return (
    <nav className="mx-auto flex max-w-2xl gap-1 overflow-x-auto px-3 pb-2 text-sm [scrollbar-width:none]">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.active ? "page" : undefined}
          className={`shrink-0 rounded-full px-3 py-1.5 font-medium transition-colors ${
            l.active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
