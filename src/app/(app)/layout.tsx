import Link from "next/link";
import type { ReactNode } from "react";
import { switchPerson } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";
import { Nav } from "@/components/Nav";
import { getSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { viewer } = await getSession();
  // Pages redirect to the login screen themselves (so they can remember where you were going).
  if (!viewer) return <>{children}</>;

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-[#fafaf9]/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
            <Logo className="h-6 w-6" />
            Family List
          </Link>
          <form action={switchPerson} className="flex min-w-0 items-center gap-1 text-sm text-zinc-500">
            <span className="truncate">{viewer.name}</span>
            <span aria-hidden>·</span>
            <button className="shrink-0 rounded-md px-1.5 py-1 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">
              Switch
            </button>
          </form>
        </div>
        <Nav isAdmin={!!viewer.is_admin} />
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6">{children}</main>
    </>
  );
}
