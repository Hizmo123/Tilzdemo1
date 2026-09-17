// Plain constants shared between the menu editor and the customer-facing
// menu. Deliberately not in an actions.ts file — a "use server" module may
// only export async functions, so exporting arrays from one turns them into
// opaque server references at runtime (see dashboard/settings/constants.ts).

export type BadgeKey =
  | "popular"
  | "new"
  | "chefs_pick"
  | "spicy"
  | "vegetarian"
  | "vegan"
  | "gluten_free"
  | "dairy_free"
  | "nut_free";

export const BADGE_VALUES: BadgeKey[] = [
  "popular",
  "new",
  "chefs_pick",
  "spicy",
  "vegetarian",
  "vegan",
  "gluten_free",
  "dairy_free",
  "nut_free",
];

export const BADGE_META: Record<
  BadgeKey,
  { label: string; className: string }
> = {
  popular: {
    label: "Popular",
    className: "bg-amber-50 text-amber-800",
  },
  new: {
    label: "New",
    className: "bg-blue-50 text-blue-700",
  },
  chefs_pick: {
    label: "Chef's pick",
    className: "bg-pine-soft text-pine-deep",
  },
  spicy: {
    label: "Spicy",
    className: "bg-danger-soft text-danger",
  },
  vegetarian: {
    label: "Vegetarian",
    className: "bg-emerald-50 text-emerald-700",
  },
  vegan: {
    label: "Vegan",
    className: "bg-emerald-50 text-emerald-700",
  },
  gluten_free: {
    label: "Gluten-free",
    className: "bg-paper text-ink-soft",
  },
  dairy_free: {
    label: "Dairy-free",
    className: "bg-paper text-ink-soft",
  },
  nut_free: {
    label: "Nut-free",
    className: "bg-paper text-ink-soft",
  },
};

// Menu layout options moved to lib/menu-style.ts when A5 added magazine/
// minimal alongside list/grid — that's the one place MENU_LAYOUTS/MenuLayout
// live now.
