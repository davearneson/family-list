export type Person = {
  id: number;
  name: string;
  household_id: number | null;
  is_child: number;
  is_admin: number;
  created_at: string;
};

export type Household = { id: number; name: string; created_at: string };

export type Item = {
  id: number;
  owner_id: number;
  added_by: number | null;
  is_idea: number;
  title: string;
  url: string | null;
  image_url: string | null;
  price: string | null;
  notes: string | null;
  quantity: number;
  most_wanted: number;
  position: number;
  created_at: string;
  updated_at: string;
  removed_at: string | null;
};

export type ClaimStatus = "reserved" | "bought";

export type ClaimInfo = {
  item_id: number;
  claimer_id: number;
  claimer_name: string;
  quantity: number;
  status: ClaimStatus;
};

/**
 * An item as one specific viewer is allowed to see it.
 * `claims` is null when the viewer must not know about claims (their own list, before the reveal).
 */
export type ItemView = Item & { added_by_name: string | null; claims: ClaimInfo[] | null };
