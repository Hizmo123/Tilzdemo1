import Link from "next/link";
import type { MenuView } from "./menu-types";

// Same link-per-view tab pattern as AnalyticsTabs / StaffTabs. Both views
// live under the one "Menu" nav entry — the active-state check in
// nav-sections.tsx is a pathname prefix match, so ?view= never un-highlights
// it.
const TABS: { view: MenuView; href: string; label: string }[] = [
  { view: "items", href: "/dashboard/menu", label: "Items" },
  { view: "categories", href: "/dashboard/menu?view=categories", label: "Categories" },
];

export function MenuTabs({ active }: { active: MenuView }) {
  return (
    <div className="flex gap-2 text-sm overflow-x-auto">
      {TABS.map((t) => (
        <Link
          key={t.view}
          href={t.href}
          className={`shrink-0 rounded-lg px-3 py-1.5 transition-colors ${
            active === t.view ? "bg-ink text-surface" : "border border-line hover:border-ink/30"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
