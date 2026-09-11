import Link from "next/link";
import { getAuthz } from "@/lib/auth";
import { getProductPerformance } from "@/lib/analytics";
import { formatCents } from "@/lib/money";
import { ProductsTable } from "../products-table";

const RANGES: { key: string; label: string; days: number | null }[] = [
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "all", label: "All time", days: null },
];

export default async function ProductAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const authz = await getAuthz();
  const restaurant = authz.membership?.organization.restaurants[0];

  if (!restaurant || !authz.can("bills:view")) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Product performance
        </h1>
        <p className="text-muted">
          {restaurant ? "You don't have permission to view analytics." : (
            <>
              Create your restaurant first from the{" "}
              <Link href="/dashboard" className="text-pine hover:underline">
                Overview
              </Link>
              .
            </>
          )}
        </p>
      </div>
    );
  }

  const { range } = await searchParams;
  const active = RANGES.find((r) => r.key === range) ?? RANGES[1];
  const currency = restaurant.currency;
  const data = await getProductPerformance(restaurant.id, active.days);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Product performance
        </h1>
        <p className="text-muted mt-1">How each menu item is selling.</p>
      </div>

      {/* Tabs to the other analytics view */}
      <div className="flex gap-2 text-sm">
        <Link
          href="/dashboard/analytics"
          className="rounded-lg border border-line px-3 py-1.5 hover:border-ink/30"
        >
          Overview
        </Link>
        <span className="rounded-lg bg-ink text-surface px-3 py-1.5">Products</span>
      </div>

      {!data.hasMenu ? (
        <p className="text-muted">Add menu items to see how they perform.</p>
      ) : (
        <>
          {/* Range selector */}
          <div className="flex gap-2">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/dashboard/analytics/products?range=${r.key}`}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  r.key === active.key
                    ? "bg-pine text-white"
                    : "border border-line hover:border-ink/30"
                }`}
              >
                {r.label}
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
              <p className="text-sm text-muted">Revenue ({active.label})</p>
              <p className="font-display text-2xl font-semibold tracking-tight mt-1 tabular-nums">
                {formatCents(data.totalRevenue, currency)}
              </p>
            </div>
            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
              <p className="text-sm text-muted">Units sold</p>
              <p className="font-display text-2xl font-semibold tracking-tight mt-1 tabular-nums">
                {data.totalUnits}
              </p>
            </div>
            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
              <p className="text-sm text-muted">Items with no sales</p>
              <p className="font-display text-2xl font-semibold tracking-tight mt-1 tabular-nums">
                {data.notSelling.length}
              </p>
            </div>
          </div>

          {data.rows.length === 0 ? (
            <p className="text-muted">No sales in this period yet.</p>
          ) : (
            <ProductsTable rows={data.rows} currency={currency} />
          )}

          {data.notSelling.length > 0 && (
            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
              <h2 className="font-display text-lg font-semibold tracking-tight">
                No sales in this period
              </h2>
              <p className="text-sm text-muted mt-1 mb-3">
                Menu items that didn&apos;t sell — worth a look, a reprice, or a cut.
              </p>
              <div className="flex flex-wrap gap-2">
                {data.notSelling.map((n) => (
                  <span
                    key={n.name}
                    className="text-sm rounded-lg border border-line px-3 py-1.5"
                  >
                    {n.name}
                    {!n.available && (
                      <span className="text-muted"> · sold out</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
