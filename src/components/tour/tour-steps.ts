// The dashboard's guided tour: the critical path from "just finished the
// wizard" to "customers can order". Deliberately NOT every feature — it
// mirrors the "Finish setting up" checklist on Overview. Plain module (no
// directive) so both the layout (server) and the provider (client) can
// read it.

export type TourPlacement = "top" | "bottom" | "auto";

export type TourStep = {
  id: string;
  // The dashboard route the target lives on. "Next" navigates here first
  // when the step is on a different page than the current one.
  page: string;
  // Matches data-tour="<target>" on the real element being pointed at.
  target: string;
  title: string;
  body: string;
  placement?: TourPlacement;
  // Lite (no ordering) has no tables, no payments and no checklist — those
  // steps simply aren't part of its tour.
  requiresOrdering?: boolean;
};

export const DASHBOARD_TOUR: TourStep[] = [
  {
    id: "checklist",
    page: "/dashboard",
    target: "checklist",
    title: "Welcome to your dashboard",
    body: "This list tracks what's left before you open the doors. It updates itself as you go — when it's empty, you're ready.",
    requiresOrdering: true,
  },
  // Points at the Items view's "Add item" button — the default view of
  // /dashboard/menu. (The provider matches step.page against the bare
  // pathname, so a target on the ?view=categories tab can't be reached.)
  {
    id: "menu",
    page: "/dashboard/menu",
    target: "menu-add-item",
    title: "Build your menu",
    body: "Add items from here — price, photo, prep station, options and allergens all live on the item. Categories have their own tab. Edit anything, any time.",
  },
  {
    id: "tables",
    page: "/dashboard/tables",
    target: "tables-add",
    title: "Add your tables",
    body: "Each table gets its own QR code the moment you add it. Customers scan it and land straight on your menu — no app, no login.",
    requiresOrdering: true,
  },
  {
    id: "payments",
    page: "/dashboard/settings/integrations",
    target: "square",
    title: "Take real payments",
    body: "Connect the Square account you already use and card payments settle straight into it. Until then, payments run in test mode.",
    requiresOrdering: true,
  },
  {
    id: "publish",
    page: "/dashboard",
    target: "publish",
    title: "Go live",
    body: "Customers can't see your venue until it's published. Once you're on a plan, this one switch opens the doors — and you can take it offline just as easily.",
  },
];

export function stepsFor(ordering: boolean): TourStep[] {
  return DASHBOARD_TOUR.filter((s) => ordering || !s.requiresOrdering);
}
