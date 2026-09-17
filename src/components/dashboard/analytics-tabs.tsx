import Link from "next/link";

const TABS = [
  { href: "/dashboard/analytics", label: "Overview" },
  { href: "/dashboard/analytics/products", label: "Products" },
  { href: "/dashboard/analytics/orders", label: "Orders" },
  { href: "/dashboard/analytics/customers", label: "Customers" },
  { href: "/dashboard/analytics/weekly", label: "Weekly report" },
] as const;

export function AnalyticsTabs({ active }: { active: string }) {
  return (
    <div className="flex gap-2 text-sm overflow-x-auto">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`shrink-0 rounded-lg px-3 py-1.5 transition-colors ${
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
