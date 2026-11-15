import { ItemForm, type Target } from "@/components/ItemForm";
import { getManagerMap, getPeople } from "@/lib/data";
import { extractUrl } from "@/lib/linkPreview";
import { SAVE_FOR_LATER } from "@/lib/saved";
import { listTargets } from "@/lib/targets";
import { requireViewer } from "@/lib/session";

const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AddPage({ searchParams }: PageProps<"/add">) {
  const sp = await searchParams;
  const qs = new URLSearchParams(Object.entries(sp).map(([k, v]) => [k, str(v)])).toString();
  const viewer = await requireViewer(qs ? `/add?${qs}` : "/add");

  const [people, managers] = await Promise.all([getPeople(), getManagerMap()]);
  const targets: Target[] = [
    {
      id: SAVE_FOR_LATER,
      label: "Save for later (only me)",
      group: "saved",
      hint: "Only you will see this. Find it under My shopping, then move it to a list whenever you decide.",
    },
    ...listTargets(viewer, people, managers),
  ];

  // ?for=<person id>, or ?for=0 for "Save for later". Missing means your own list.
  const requested = str(sp.for).trim() === "" ? NaN : Number(str(sp.for));
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
        people={people.filter((p) => p.id !== viewer.id).map((p) => ({ id: p.id, name: p.name }))}
        initialFor={requested > 0 && requested !== viewer.id ? [requested] : []}
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
