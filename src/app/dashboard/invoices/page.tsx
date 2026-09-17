import Link from "next/link";
import { getActiveLocation } from "@/lib/auth";
import { getInvoices, recentInvoicesRange, RECENT_INVOICES_DAYS } from "@/lib/invoices";
import { parseRangeParams } from "@/lib/date-range";
import { formatCents } from "@/lib/money";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
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
          <Link href="/dashboard" className="text-pine hover:underline">
            Overview
          </Link>{" "}
          page.
        </p>
      </div>
    );
  }

  const { restaurant, location } = ctx;
  const currency = restaurant.currency;
  const sp = await searchParams;
  const { preset, resolved } = parseRangeParams(sp, restaurant.timezone);
  const q = sp.q?.trim() || undefined;

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
            className="text-sm rounded-lg border border-line px-3 py-1.5 hover:border-ink/30"
          >
            Export CSV
          </a>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <DateRangePicker value={preset} customFrom={sp.from} customTo={sp.to} />
          <form method="GET" className="flex items-center gap-2">
            <input type="hidden" name="range" value={preset} />
            {sp.from && <input type="hidden" name="from" value={sp.from} />}
            {sp.to && <input type="hidden" name="to" value={sp.to} />}
            <input
              type="search"
              name="q"
              defaultValue={sp.q}
              placeholder="Search table, name or email"
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm focus:border-pine focus:outline-none w-56"
            />
            <button
              type="submit"
              className="text-sm rounded-lg border border-line px-3 py-1.5 hover:border-ink/30"
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
