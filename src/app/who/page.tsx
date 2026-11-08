import { redirect } from "next/navigation";
import { pickPerson } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";
import { SubmitButton } from "@/components/Buttons";
import { getHouseholds, getPeople } from "@/lib/data";
import { getSession, safeNext } from "@/lib/session";
import { SetupForm } from "./SetupForm";

export default async function WhoPage({ searchParams }: PageProps<"/who">) {
  const next = safeNext((await searchParams).next);
  const { family } = await getSession();
  if (!family) redirect(`/login?next=${encodeURIComponent(next)}`);

  const [people, households] = await Promise.all([getPeople(), getHouseholds()]);
  const adults = people.filter((p) => !p.is_child);

  if (adults.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
        <Logo className="mb-6 h-12 w-12" />
        <h1 className="text-2xl font-semibold tracking-tight">Let&rsquo;s set up your family</h1>
        <p className="mt-1 mb-8 text-zinc-500">
          You&rsquo;re the first one here, so you&rsquo;ll be the admin. Next you&rsquo;ll add everyone else.
        </p>
        <SetupForm />
      </main>
    );
  }

  const groups = [
    ...households.map((h) => ({ name: h.name, people: adults.filter((p) => p.household_id === h.id) })),
    { name: "Others", people: adults.filter((p) => !households.some((h) => h.id === p.household_id)) },
  ].filter((g) => g.people.length);

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
      <Logo className="mb-6 h-10 w-10" />
      <h1 className="text-2xl font-semibold tracking-tight">Who are you?</h1>
      <p className="mt-1 mb-8 text-zinc-500">Kids&rsquo; lists are run by their parents, so only grown-ups are listed.</p>
      <form action={pickPerson} className="space-y-6">
        <input type="hidden" name="next" value={next} />
        {groups.map((g) => (
          <section key={g.name}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{g.name}</h2>
            <div className="grid grid-cols-2 gap-2">
              {g.people.map((p) => (
                <SubmitButton
                  key={p.id}
                  name="person_id"
                  value={String(p.id)}
                  className="h-14 truncate rounded-xl border border-zinc-200 bg-white px-4 text-left text-[15px] font-medium hover:border-zinc-900 disabled:opacity-50"
                >
                  {p.name}
                </SubmitButton>
              ))}
            </div>
          </section>
        ))}
      </form>
    </main>
  );
}
