import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getSession, safeNext } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNext((await searchParams).next);
  const { family } = await getSession();
  if (family) redirect(`/who?next=${encodeURIComponent(next)}`);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <Logo className="mb-6 h-12 w-12" />
      <h1 className="text-2xl font-semibold tracking-tight">Family List</h1>
      <p className="mt-1 mb-8 text-zinc-500">Enter the family password to see everyone&rsquo;s lists.</p>
      <LoginForm next={next} />
    </main>
  );
}
