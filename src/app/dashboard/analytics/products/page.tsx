import Link from "next/link";
import { getAuthz } from "@/lib/auth";
import { getEntitlements } from "@/lib/entitlements";
import { getProductPerformance } from "@/lib/analytics";
import { parseRangeParams, clampRangeToWindow } from "@/lib/date-range";
import { formatCents } from "@/lib/money";
import { AnalyticsTabs } from "@/components/dashboard/analytics-tabs";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { StatCard } from "@/components/dashboard/stat-card";
import { ProductsTable } from "../products-table";
import { HistoryWindowNote } from "@/components/dashboard/history-window-note";

export default async function ProductAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
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
          {restaurant ? (
            "You don't have permission to view analytics."
          ) : (
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

  const sp = await searchParams;
  const { preset, resolved: requested } = parseRangeParams(sp, restaurant.timezone);
  const entitlements = await getEntitlements(restaurant.organizationId);
  const { resolved, clamped } = clampRangeToWindow(
    requested,
    entitlements.analyticsWindowDays,
    restaurant.timezone,
  );
  const currency = restaurant.currency;
  const data = await getProductPerformance(restaurant.id, resolved);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Product performance
        </h1>
        <p className="text-muted mt-1">How each menu item is selling.</p>
      </div>

      <AnalyticsTabs active="/dashboard/analytics/products" />

      {!data.hasMenu ? (
        <p className="text-muted">Add menu items to see how they perform.</p>
      ) : (
        <>
          <DateRangePicker value={preset} customFrom={sp.from} customTo={sp.to} />
          {clamped && <HistoryWindowNote />}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard
              label={`Revenue · ${resolved.label}`}
              value={formatCents(data.totalRevenue, currency)}
            />
            <StatCard label="Units sold" value={String(data.totalUnits)} />
            <StatCard label="Items with no sales" value={String(data.notSelling.length)} />
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
                    {!n.available && <span className="text-muted"> · sold out</span>}
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
