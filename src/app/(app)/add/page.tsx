import { ItemForm, type Target } from "@/components/ItemForm";
import { getManagerMap, getPeople } from "@/lib/data";
import { possessive } from "@/lib/format";
import { extractUrl } from "@/lib/linkPreview";
import { requireViewer } from "@/lib/session";

const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AddPage({ searchParams }: PageProps<"/add">) {
  const sp = await searchParams;
  const qs = new URLSearchParams(Object.entries(sp).map(([k, v]) => [k, str(v)])).toString();
  const viewer = await requireViewer(qs ? `/add?${qs}` : "/add");

  const [people, managers] = await Promise.all([getPeople(), getManagerMap()]);
  const managed = people.filter((p) => p.is_child && managers[p.id]?.includes(viewer.id));
  const managedIds = new Set(managed.map((p) => p.id));
  const others = people.filter((p) => p.id !== viewer.id && !managedIds.has(p.id));

  const targets: Target[] = [
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

  const requested = Number(str(sp.for));
  const defaultTargetId = targets.some((t) => t.id === requested) ? requested : viewer.id;

  // Links arrive from the share sheet / bookmarklet as ?url= (or buried in ?text=).
  const sharedUrl = extractUrl(str(sp.url)) ?? extractUrl(str(sp.text)) ?? extractUrl(str(sp.title)) ?? "";
  const sharedTitle = str(sp.title).trim();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Add an item</h1>
      <ItemForm
        mode="add"
        targets={targets}
        defaultTargetId={defaultTargetId}
        autoLookup={!!sharedUrl}
        initial={{
          url: sharedUrl,
          title: extractUrl(sharedTitle) ? "" : sharedTitle.slice(0, 200),
          image_url: str(sp.image),
          price: str(sp.price).slice(0, 40),
          notes: "",
          quantity: 1,
          most_wanted: false,
        }}
      />
    </div>
  );
}
