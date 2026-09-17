import Link from "next/link";
import { getAuthz } from "@/lib/auth";
import { getCustomerTracking } from "@/lib/analytics";
import { parseRangeParams } from "@/lib/date-range";
import { formatCents } from "@/lib/money";
import { AnalyticsTabs } from "@/components/dashboard/analytics-tabs";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { StatCard } from "@/components/dashboard/stat-card";

export default async function CustomerAnalyticsPage({
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
          Customers
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
  const { preset, resolved } = parseRangeParams(sp, restaurant.timezone);
  const currency = restaurant.currency;
  const data = await getCustomerTracking(restaurant.id, resolved);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Customers</h1>
        <p className="text-muted mt-1 max-w-2xl">
          Tillz doesn&apos;t have customer accounts — guests are anonymous QR
          sessions. What&apos;s below is table visits, and real repeat-visit
          tracking for anyone who&apos;s left a phone number for an
          &quot;order ready&quot; text.
        </p>
      </div>

      <AnalyticsTabs active="/dashboard/analytics/customers" />
      <DateRangePicker value={preset} customFrom={sp.from} customTo={sp.to} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="Visits" value={String(data.visits)} />
        <StatCard label="Identified (left a phone)" value={String(data.identifiedCustomers)} />
        <StatCard
          label="New vs returning"
          value={`${data.newCustomers} / ${data.returningCustomers}`}
        />
      </div>

      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight mb-1">
          Top customers
        </h2>
        <p className="text-sm text-muted mb-4">By spend in this period, among those who left a phone number.</p>
        {data.topCustomers.length === 0 ? (
          <p className="text-sm text-muted">No identified customers in this period.</p>
        ) : (
          <div className="space-y-2">
            {data.topCustomers.map((c) => (
              <div key={c.phone} className="flex items-center justify-between text-sm">
                <span>
                  <span className="font-medium">{c.name || "Guest"}</span>{" "}
                  <span className="text-muted">{c.phone}</span>
                </span>
                <span className="text-right">
                  <span className="tabular-nums font-medium">
                    {formatCents(c.totalSpentCents, currency)}
                  </span>{" "}
                  <span className="text-muted tabular-nums">
                    · {c.visits} visit{c.visits === 1 ? "" : "s"}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
