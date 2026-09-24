import Link from "next/link";

// Same link-per-route tab pattern as AnalyticsTabs — each tab is a real page
// with its own Server Component data fetch and permission check, not a
// client-side panel switch, so nothing about how these pages work changes.
const TABS = [
  { href: "/dashboard/staff", label: "Members" },
  { href: "/dashboard/staff/logins", label: "Staff logins" },
  { href: "/dashboard/staff/activity", label: "Activity" },
] as const;

export function StaffTabs({
  active,
  showActivity,
}: {
  active: string;
  // Activity's own audit:view check still runs on that page — this just
  // avoids showing a tab that would immediately deny the viewer.
  showActivity: boolean;
}) {
  const tabs = showActivity ? TABS : TABS.filter((t) => t.label !== "Activity");
  return (
    <div className="flex gap-2 text-sm overflow-x-auto">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`shrink-0 rounded-[var(--radius-sm)] px-3 py-1.5 transition-colors ${
            active === t.href
              ? "bg-ink text-surface"
              : "border border-line hover:border-ink/30"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
