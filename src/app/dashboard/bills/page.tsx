import Link from "next/link";
import { getActiveLocation } from "@/lib/auth";
import { getEntitlements } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { getPaidBillsHistory } from "@/lib/bills";
import { formatCents } from "@/lib/money";
import {
  parseRangeParams,
  clampRangeToWindow,
  disabledPresets,
  earliestAllowedDateStr,
} from "@/lib/date-range";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { HistoryWindowNote } from "@/components/dashboard/history-window-note";
import { LiveRefresh } from "../live-refresh";

const PAGE_SIZE = 20;

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    view?: string;
    table?: string;
    page?: string;
  }>;
}) {
  const ctx = await getActiveLocation();

  if (!ctx) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Bills
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

  const { restaurant, location, membership } = ctx;
  const currency = restaurant.currency;
  const sp = await searchParams;
  const ent = await getEntitlements(membership.organizationId);

  const view: "all" | "table" = sp.view === "table" ? "table" : "all";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  // Same clamp-to-plan pattern as Analytics/Order History
  // (entitlements.analyticsWindowDays) — see lib/date-range.ts.
  const { preset, resolved: requestedRange } = parseRangeParams(sp, restaurant.timezone, "30d");
  const { resolved: range, clamped } = clampRangeToWindow(
    requestedRange,
    ent.analyticsWindowDays,
    restaurant.timezone,
  );

  // Bill.restaurantId/locationId are set directly on every bill (including
  // COUNTER bills, which have tableId: null) — filtering through the table
  // relation instead (the bug this page used to have) silently excludes
  // every counter sale, since a null tableId can never match a table join.
  const [open, tables, { bills: historyBills, total: historyTotal }] = await Promise.all([
    prisma.bill.findMany({
      where: {
        restaurantId: restaurant.id,
        status: { in: ["OPEN", "PARTIALLY_PAID"] },
      },
      orderBy: { createdAt: "desc" },
      include: { table: true, items: true },
    }),
    prisma.table.findMany({
      where: { locationId: location.id },
      orderBy: [{ section: "asc" }, { createdAt: "asc" }],
    }),
    getPaidBillsHistory(
      restaurant.id,
      range,
      view === "table" && sp.table
        ? { tableId: sp.table, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }
        : { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
    ),
  ]);

  const selectedTable = view === "table" ? tables.find((t) => t.id === sp.table) ?? null : null;
  const totalPages = Math.max(1, Math.ceil(historyTotal / PAGE_SIZE));

  // Preserves every other filter param when only one changes (view, page,
  // table) — DateRangePicker does the equivalent for range/from/to.
  function historyHref(overrides: Record<string, string | null>) {
    const params = new URLSearchParams();
    if (sp.range) params.set("range", sp.range);
    if (sp.from) params.set("from", sp.from);
    if (sp.to) params.set("to", sp.to);
    if (view === "table") params.set("view", "table");
    if (sp.table) params.set("table", sp.table);
    if (page > 1) params.set("page", String(page));
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/dashboard/bills?${qs}` : "/dashboard/bills";
  }

  return (
    <div className="space-y-8">
      <LiveRefresh restaurantId={restaurant.id} />
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Bills
        </h1>
        <p className="text-muted mt-1">{restaurant.name}</p>
      </div>

      <section>
        <h2 className="font-display text-lg font-semibold tracking-tight mb-3">
          Open ({open.length})
        </h2>
        {open.length === 0 ? (
          <p className="text-sm text-muted">No open bills right now.</p>
        ) : (
          <div className="space-y-2">
            {open.map((b) => {
              const remaining = b.totalCents - b.amountPaidCents;
              return (
                <div
                  key={b.id}
                  className="rounded-[var(--radius-card)] border border-line bg-surface p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{b.table ? `Table ${b.table.label}` : "Counter"}</p>
                    <p className="text-sm text-muted">
                      {b.items.length} {b.items.length === 1 ? "item" : "items"}
                      {b.amountPaidCents > 0
                        ? ` · ${formatCents(b.amountPaidCents, currency)} paid`
                        : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium tabular-nums">
                      {formatCents(remaining, currency)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-amber-700">
                      {b.status === "PARTIALLY_PAID" ? "Part-paid" : "Open"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            History
          </h2>
          <div className="flex gap-2 text-sm">
            <Link
              href={historyHref({ view: null, table: null, page: null })}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                view === "all" ? "bg-ink text-surface" : "border border-line hover:border-ink/30"
              }`}
            >
              All tables
            </Link>
            <Link
              href={historyHref({ view: "table", page: null })}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                view === "table" ? "bg-ink text-surface" : "border border-line hover:border-ink/30"
              }`}
            >
              By table
            </Link>
          </div>
        </div>

        <div className="mb-4 space-y-2">
          <DateRangePicker
            value={preset}
            customFrom={sp.from}
            customTo={sp.to}
            disabledPresets={disabledPresets(ent.analyticsWindowDays, restaurant.timezone)}
            minCustomDate={earliestAllowedDateStr(ent.analyticsWindowDays, restaurant.timezone) ?? undefined}
          />
          {clamped && <HistoryWindowNote />}
        </div>

        {view === "table" && (
          <form method="get" action="/dashboard/bills" className="mb-4 flex items-center gap-2">
            {sp.range && <input type="hidden" name="range" value={sp.range} />}
            {sp.from && <input type="hidden" name="from" value={sp.from} />}
            {sp.to && <input type="hidden" name="to" value={sp.to} />}
            <input type="hidden" name="view" value="table" />
            <label htmlFor="table-select" className="text-sm text-muted">
              Table
            </label>
            <select
              id="table-select"
              name="table"
              defaultValue={sp.table ?? ""}
              className="rounded-lg border border-line px-3 py-1.5 text-sm bg-surface"
            >
              <option value="" disabled>
                Choose a table…
              </option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                  {t.section ? ` · ${t.section}` : ""}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-ink/30"
            >
              Go
            </button>
          </form>
        )}

        <p className="text-sm text-muted mb-3">
          {range.label}
          {selectedTable ? ` · Table ${selectedTable.label}` : ""} · {historyTotal} paid bill
          {historyTotal === 1 ? "" : "s"}
        </p>

        {view === "table" && !selectedTable ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-8 text-center">
            <p className="text-muted">Choose a table above to see its history.</p>
          </div>
        ) : historyBills.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-8 text-center">
            <p className="text-muted">No paid bills in this range.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {historyBills.map((b) => (
                <div
                  key={b.id}
                  className="rounded-[var(--radius-card)] border border-line bg-surface p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{b.tableLabel}</p>
                    <p className="text-sm text-muted">
                      {b.paidAt ? new Date(b.paidAt).toLocaleString("en-AU") : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="font-medium tabular-nums">
                        {formatCents(b.totalCents, currency)}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-pine-deep">
                        Paid
                      </p>
                    </div>
                    <Link
                      href={`/receipt/${b.id}`}
                      className="text-sm rounded-lg border border-line px-3 py-1.5 hover:border-ink/30"
                    >
                      Receipt
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 text-sm">
                {page > 1 ? (
                  <Link
                    href={historyHref({ page: page - 1 === 1 ? null : String(page - 1) })}
                    className="rounded-lg border border-line px-3 py-1.5 hover:border-ink/30"
                  >
                    ← Newer
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-muted">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages ? (
                  <Link
                    href={historyHref({ page: String(page + 1) })}
                    className="rounded-lg border border-line px-3 py-1.5 hover:border-ink/30"
                  >
                    Older →
                  </Link>
                ) : (
                  <span />
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
