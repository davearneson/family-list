import { possessive } from "./format";
import type { Person } from "./types";

export type Target = {
  id: number;
  label: string;
  /** mine = a list you run, idea = a secret idea on someone else's, saved = your private saved ideas */
  group: "mine" | "idea" | "saved";
  /** Shown under the picker so it's clear who will (and won't) see the item. */
  hint: string;
};

/** Every list the viewer can put something on: their own, kids they manage, and ideas for everyone else. */
export function listTargets(viewer: Person, people: Person[], managers: Record<number, number[]>): Target[] {
  const managed = people.filter((p) => p.is_child && managers[p.id]?.includes(viewer.id));
  const managedIds = new Set(managed.map((p) => p.id));
  const others = people.filter((p) => p.id !== viewer.id && !managedIds.has(p.id));
  return [
    { id: viewer.id, label: "My list", group: "mine", hint: "Goes on your list for everyone to see." },
    ...managed.map((p) => ({
      id: p.id,
      label: `${possessive(p.name)} list`,
      group: "mine" as const,
      hint: `Goes on ${possessive(p.name)} list for everyone to see.`,
    })),
    ...others.map((p) => ({
      id: p.id,
      label: p.is_child ? `Gift idea for ${p.name}` : `Secret idea for ${p.name}`,
      group: "idea" as const,
      hint: p.is_child
        ? `Shows on ${possessive(p.name)} list as an idea from you.`
        : `Only other gift-givers will see this. ${p.name} won't.`,
    })),
  ];
}
