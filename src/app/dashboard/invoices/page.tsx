import Link from "next/link";
import { buttonClasses } from "@/components/ui/button-classes";
import { getActiveLocation } from "@/lib/auth";
import { getEntitlements } from "@/lib/entitlements";
import { getInvoices, recentInvoicesRange, RECENT_INVOICES_DAYS } from "@/lib/invoices";
import { parseRangeParams, clampRangeToWindow } from "@/lib/date-range";
import { formatCents } from "@/lib/money";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { HistoryWindowNote } from "@/components/dashboard/history-window-note";
import { InvoiceListRow } from "@/components/dashboard/invoice-list-row";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; q?: string }>;
}) {
  const ctx = await getActiveLocation();

  if (!ctx) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Invoices
        </h1>
        <p className="text-muted">
          Create your restaurant first from the{" "}
          <Link href="/dashboard" prefetch={false} className="text-pine hover:underline">
            Overview
          </Link>{" "}
          page.
        </p>
      </div>
    );
  }

  const { restaurant, location, membership } = ctx;
  const currency = restaurant.currency;
  const sp = await searchParams;
  const { preset, resolved: requested } = parseRangeParams(sp, restaurant.timezone);
  const q = sp.q?.trim() || undefined;

  // Same clamp-to-plan pattern as Analytics/Bills (entitlements.
  // analyticsWindowDays) — see lib/date-range.ts. RECENT_INVOICES_DAYS
  // (14) is a fixed short window rather than a searchParams-driven one, so
  // it isn't clamped here: an org whose plan even shows this page already
  // has ordering (this page sits behind requireOrdering()), and every
  // tier's window is null (unlimited) or >= 14 days.
  const ent = await getEntitlements(membership.organizationId);
  const { resolved, clamped } = clampRangeToWindow(requested, ent.analyticsWindowDays, restaurant.timezone);

  const [recent, filtered] = await Promise.all([
    getInvoices(location.id, recentInvoicesRange()),
    getInvoices(location.id, resolved, q),
  ]);

  const exportHref = `/dashboard/invoices/export?range=${preset}${sp.from ? `&from=${sp.from}` : ""}${sp.to ? `&to=${sp.to}` : ""}`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Invoices</h1>
        <p className="text-muted mt-1">
          Every paid bill, with its tax invoice one click away. Nothing here is ever deleted.
        </p>
      </div>

      {/* Recent — the fast, no-filter-needed view */}
      <section>
        <h2 className="font-display text-lg font-semibold tracking-tight mb-3">
          Recent (last {RECENT_INVOICES_DAYS} days)
        </h2>
        {recent.rows.length === 0 ? (
          <p className="text-sm text-muted">No paid bills in the last {RECENT_INVOICES_DAYS} days.</p>
        ) : (
          <div className="rounded-[var(--radius-card)] border border-line bg-surface divide-y divide-line">
            {recent.rows.slice(0, 8).map((r) => (
              <InvoiceListRow key={r.id} row={r} currency={currency} />
            ))}
          </div>
        )}
      </section>

      {/* Full searchable history */}
      <section className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">Full history</h2>
          <a
            href={exportHref}
            className={buttonClasses("secondary", "sm")}
          >
            Export CSV
          </a>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <DateRangePicker value={preset} customFrom={sp.from} customTo={sp.to} />
          {clamped && <HistoryWindowNote />}
          <form method="GET" className="flex items-center gap-2">
            <input type="hidden" name="range" value={preset} />
            {sp.from && <input type="hidden" name="from" value={sp.from} />}
            {sp.to && <input type="hidden" name="to" value={sp.to} />}
            <input
              type="search"
              name="q"
              defaultValue={sp.q}
              placeholder="Search table, name or email"
              className="h-9 w-56 rounded-[var(--radius-sm)] border border-line bg-surface px-3 text-sm shadow-rest focus:outline-none focus:border-pine focus:ring-[3px] focus:ring-pine/20"
            />
            <button
              type="submit"
              className={buttonClasses("secondary", "sm")}
            >
              Search
            </button>
          </form>
        </div>

        {filtered.rows.length === 0 ? (
          <p className="text-sm text-muted">No paid bills match this filter.</p>
        ) : (
          <>
            <div className="rounded-[var(--radius-card)] border border-line bg-surface divide-y divide-line">
              {filtered.rows.map((r) => (
                <InvoiceListRow key={r.id} row={r} currency={currency} />
              ))}
            </div>
            {filtered.truncated && (
              <p className="text-xs text-muted">
                Showing the most recent 200 of more matching bills — narrow the date range to
                see the rest, or use Export CSV for the full set.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
