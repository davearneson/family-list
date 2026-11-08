import { redirect } from "next/navigation";
import {
  addHousehold,
  addPerson,
  deleteHousehold,
  deletePerson,
  renameHousehold,
  saveSettings,
  updatePerson,
} from "@/app/actions/family";
import { SubmitButton } from "@/components/Buttons";
import { PersonFields } from "@/components/PersonFields";
import { RevealInput } from "@/components/RevealInput";
import { button, card, chip, input, label } from "@/components/ui";
import { getHouseholds, getManagerMap, getPeople, getRevealAt, getSetting } from "@/lib/data";
import { usesFileDb } from "@/lib/db";
import { joinNames } from "@/lib/format";
import { requireViewer } from "@/lib/session";
import type { Household, Person } from "@/lib/types";

export default async function FamilyPage() {
  const viewer = await requireViewer("/family");
  if (!viewer.is_admin) redirect("/");

  const [people, households, managers, revealAt, shortcutUrl] = await Promise.all([
    getPeople(),
    getHouseholds(),
    getManagerMap(),
    getRevealAt(),
    getSetting("shortcut_url"),
  ]);
  const adults = people.filter((p) => !p.is_child);
  const nameOf = (id: number) => people.find((p) => p.id === id)?.name ?? "?";
  const unassigned = people.filter((p) => !households.some((h) => h.id === p.household_id));
  const adultCount = adults.length;
  const kidCount = people.length - adultCount;

  function personRow(p: Person) {
    const parentIds = managers[p.id] ?? [];
    return (
      <li key={p.id} className="py-2.5">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium">{p.name}</span>
              {p.is_child ? <span className={chip.neutral}>Kid</span> : null}
              {p.is_admin ? <span className={chip.neutral}>Admin</span> : null}
            </span>
            <span className="flex shrink-0 items-center gap-2 text-sm text-zinc-500">
              {p.is_child ? (parentIds.length ? `Parents: ${joinNames(parentIds.map(nameOf))}` : "No parents set") : null}
              <span className="text-zinc-400 group-open:rotate-90">›</span>
            </span>
          </summary>
          <form action={updatePerson} className="mt-3 space-y-3 rounded-lg bg-zinc-50 p-3">
            <input type="hidden" name="id" value={p.id} />
            <div className="grid grid-cols-2 gap-2">
              <input name="name" defaultValue={p.name} maxLength={60} aria-label="Name" className={input} />
              <select
                name="household_id"
                defaultValue={p.household_id ?? ""}
                aria-label="Household"
                className={`${input} appearance-auto`}
              >
                <option value="">No household</option>
                {households.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
            {p.is_child ? (
              <fieldset>
                <legend className={label}>Parents who manage this list</legend>
                <div className="grid grid-cols-2 gap-1.5 text-[15px]">
                  {adults.map((a) => (
                    <label key={a.id} className="flex items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        name="parents"
                        value={a.id}
                        defaultChecked={parentIds.includes(a.id)}
                        className="h-4 w-4 accent-zinc-900"
                      />
                      {a.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <label className="flex items-center gap-2 text-[15px]">
                <input
                  type="checkbox"
                  name="is_admin"
                  defaultChecked={!!p.is_admin}
                  disabled={p.id === viewer.id}
                  className="h-4 w-4 accent-zinc-900"
                />
                Admin (can manage the family and settings)
              </label>
            )}
            <div className="flex items-center justify-between gap-2">
              <SubmitButton className={button("primary", "sm")}>Save</SubmitButton>
              {p.id !== viewer.id && (
                <SubmitButton
                  className={button("danger", "sm")}
                  formAction={deletePerson}
                  confirm={`Delete ${p.name}? Their list and everything they've reserved will be deleted. This can't be undone.`}
                >
                  Delete
                </SubmitButton>
              )}
            </div>
          </form>
        </details>
      </li>
    );
  }

  function householdCard(h: Household | null, members: Person[]) {
    return (
      <section key={h?.id ?? "none"} className={`${card} p-4`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">{h ? h.name : "No household"}</h2>
          {h && (
            <details className="relative">
              <summary className="cursor-pointer list-none text-sm text-zinc-500 hover:text-zinc-900">Rename</summary>
              <div className="absolute right-0 z-10 mt-2 w-72 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg">
                <form action={renameHousehold} className="flex gap-2">
                  <input type="hidden" name="id" value={h.id} />
                  <input name="name" defaultValue={h.name} maxLength={60} aria-label="Household name" className={input} />
                  <SubmitButton className={button("primary")}>Save</SubmitButton>
                </form>
                {members.length === 0 && (
                  <form action={deleteHousehold} className="mt-2">
                    <input type="hidden" name="id" value={h.id} />
                    <SubmitButton className={button("danger", "sm")}>Delete household</SubmitButton>
                  </form>
                )}
              </div>
            </details>
          )}
        </div>
        {members.length > 0 ? (
          <ul className="mt-1 divide-y divide-zinc-100">{members.map(personRow)}</ul>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">Nobody here yet.</p>
        )}
        {h && (
          <details className="mt-2 border-t border-zinc-100 pt-3">
            <summary className="cursor-pointer text-sm font-medium text-zinc-600 hover:text-zinc-900">
              + Add someone to {h.name}
            </summary>
            <form action={addPerson} className="mt-3 space-y-3">
              <PersonFields households={households} adults={adults} defaultHouseholdId={h.id} />
              <SubmitButton className={button("primary", "sm")}>Add person</SubmitButton>
            </form>
          </details>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Family</h1>
        <p className="mt-1 text-zinc-500">
          {adultCount} {adultCount === 1 ? "adult" : "adults"} and {kidCount} {kidCount === 1 ? "kid" : "kids"}. Grown-ups
          log in with the family password and pick their name. Kids&rsquo; lists are run by their parents.
        </p>
      </div>

      <div className="space-y-3">
        {households.map((h) =>
          householdCard(
            h,
            people.filter((p) => p.household_id === h.id),
          ),
        )}
        {unassigned.length > 0 && householdCard(null, unassigned)}
      </div>

      <form action={addHousehold} className={`${card} flex gap-2 p-4`}>
        <input name="name" required maxLength={60} placeholder="New household, e.g. Grandma & Grandpa" aria-label="New household name" className={input} />
        <SubmitButton className={`${button("secondary")} shrink-0`}>Add household</SubmitButton>
      </form>

      <section className={`${card} space-y-5 p-4`}>
        <h2 className="font-semibold">Settings</h2>
        <form action={saveSettings} className="space-y-5">
          <div>
            <p className={label}>Christmas reveal</p>
            <p className="mb-2 text-sm text-zinc-500">
              From this moment on, people can see who got them what (only things marked bought).
            </p>
            <RevealInput iso={revealAt.toISOString()} />
          </div>
          <div>
            <label htmlFor="shortcut_url" className={label}>
              iPhone shortcut link
            </label>
            <p className="mb-2 text-sm text-zinc-500">
              After you make the &ldquo;Add to Family List&rdquo; shortcut (see Add from web), paste its iCloud link here so
              everyone can install it with one tap.
            </p>
            <input
              id="shortcut_url"
              name="shortcut_url"
              type="url"
              defaultValue={shortcutUrl ?? ""}
              placeholder="https://www.icloud.com/shortcuts/…"
              className={input}
            />
          </div>
          <SubmitButton className={button("primary", "sm")}>Save settings</SubmitButton>
        </form>
      </section>

      <section className={`${card} p-4`}>
        <h2 className="font-semibold">Backups</h2>
        {usesFileDb() ? (
          <>
            <p className="mt-1 mb-3 text-sm text-zinc-500">
              Everything (people, lists, reservations) is in one file. Download a copy now and then, especially in
              December, and keep it somewhere safe.
            </p>
            <a href="/family/backup" download className={button("secondary", "sm")}>
              Download a backup
            </a>
          </>
        ) : (
          <p className="mt-1 text-sm text-zinc-500">Your Turso database keeps its own backups.</p>
        )}
      </section>
    </div>
  );
}
