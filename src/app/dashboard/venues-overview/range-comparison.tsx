import { parseRangeParams } from "@/lib/date-range";
import { getVenuesRangeComparison } from "@/lib/venues-overview";
import { formatCents } from "@/lib/money";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";

// The deeper cross-venue view (entitlements.crossVenueDashboard) — a
// same-range comparison across every venue in the org, reusing the exact
// date-range machinery Analytics/Order History already use rather than a
// new one. Combined CSV export is a natural next step here but isn't built
// yet — this ships the comparison table itself first.
export async function RangeComparison({
  organizationId,
  timezone,
  searchParams,
}: {
  organizationId: string;
  timezone: string;
  searchParams: { range?: string; from?: string; to?: string };
}) {
  const { preset, resolved } = parseRangeParams(searchParams, timezone, "30d");
  const rows = await getVenuesRangeComparison(organizationId, resolved);
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenueCents, 0);
  const totalOrders = rows.reduce((sum, r) => sum + r.paidOrders, 0);
  const currency = rows[0]?.currency ?? "AUD";

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Compare venues — {resolved.label}
        </h2>
        <p className="text-sm text-muted mt-0.5">Paid revenue and order count, side by side.</p>
      </div>

      <DateRangePicker value={preset} customFrom={searchParams.from} customTo={searchParams.to} />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-line">
              <th className="py-2.5 font-medium">Venue</th>
              <th className="py-2.5 font-medium text-right">Revenue</th>
              <th className="py-2.5 font-medium text-right">Paid orders</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="py-2.5 font-medium">{r.name}</td>
                <td className="py-2.5 text-right tabular-nums">{formatCents(r.revenueCents, r.currency)}</td>
                <td className="py-2.5 text-right tabular-nums">{r.paidOrders}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line font-medium">
              <td className="py-2.5">Total</td>
              <td className="py-2.5 text-right tabular-nums">{formatCents(totalRevenue, currency)}</td>
              <td className="py-2.5 text-right tabular-nums">{totalOrders}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
