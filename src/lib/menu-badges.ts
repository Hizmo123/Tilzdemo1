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
  | "gluten_free";

export const BADGE_VALUES: BadgeKey[] = [
  "popular",
  "new",
  "chefs_pick",
  "spicy",
  "vegetarian",
  "vegan",
  "gluten_free",
];

export const BADGE_META: Record<
  BadgeKey,
  { label: string; emoji: string; className: string }
> = {
  popular: {
    label: "Popular",
    emoji: "🔥",
    className: "bg-amber-50 text-amber-800",
  },
  new: {
    label: "New",
    emoji: "✨",
    className: "bg-blue-50 text-blue-700",
  },
  chefs_pick: {
    label: "Chef's pick",
    emoji: "👨‍🍳",
    className: "bg-pine-soft text-pine-deep",
  },
  spicy: {
    label: "Spicy",
    emoji: "🌶️",
    className: "bg-danger-soft text-danger",
  },
  vegetarian: {
    label: "Vegetarian",
    emoji: "🌱",
    className: "bg-emerald-50 text-emerald-700",
  },
  vegan: {
    label: "Vegan",
    emoji: "🌿",
    className: "bg-emerald-50 text-emerald-700",
  },
  gluten_free: {
    label: "Gluten-free",
    emoji: "🌾",
    className: "bg-paper text-ink-soft",
  },
};

// A curated set of category emoji — not exhaustive (any emoji is accepted),
// just quick picks so setting one takes one tap instead of opening a picker.
export const CATEGORY_ICON_SUGGESTIONS = [
  "☕",
  "🍳",
  "🥐",
  "🥗",
  "🍔",
  "🌮",
  "🍕",
  "🍜",
  "🍰",
  "🍦",
  "🍹",
  "🍺",
  "🍷",
  "🥃",
];

// Menu layout options moved to lib/menu-style.ts when A5 added magazine/
// minimal alongside list/grid — that's the one place MENU_LAYOUTS/MenuLayout
// live now.
