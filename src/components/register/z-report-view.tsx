import { formatCents } from "@/lib/money";
import type { ZReport } from "@/lib/cash-drawer";

// A printable end-of-shift cash reconciliation — same visual language as
// TaxInvoice (components/receipt/tax-invoice.tsx) so it's consistent with
// the other printable document in this app, reused for both the immediate
// post-close view and register/history's per-session view.
export function ZReportView({
  report,
  restaurantName,
  locationName,
  currency,
}: {
  report: ZReport;
  restaurantName: string;
  locationName: string;
  currency: string;
}) {
  return (
    <div className="mx-auto max-w-md bg-white text-[#15181b] rounded-[var(--radius-card)] border border-[#e6e3dc] p-7 print:border-0 print:rounded-none print:max-w-none">
      <div className="text-center border-b border-dashed border-[#d8d4ca] pb-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#6b7169]">
          Z-Report
        </p>
        <h1 className="text-xl font-semibold mt-1">{restaurantName}</h1>
        <p className="text-xs text-[#6b7169] mt-0.5">{locationName}</p>
      </div>

      <div className="flex justify-between text-xs text-[#3a4147] mt-4">
        <span>
          Opened {new Date(report.openedAt).toLocaleString("en-AU", {
            dateStyle: "medium",
            timeStyle: "short",
          })}{" "}
          by {report.openedByName}
        </span>
        <span className="uppercase tracking-wide">{report.status}</span>
      </div>
      {report.closedAt && (
        <p className="text-xs text-[#3a4147] mt-1">
          Closed{" "}
          {new Date(report.closedAt).toLocaleString("en-AU", {
            dateStyle: "medium",
            timeStyle: "short",
          })}{" "}
          by {report.closedByName}
        </p>
      )}

      <div className="border-t border-[#e6e3dc] mt-3 pt-3 text-sm space-y-1">
        <Row label="Opening float" value={formatCents(report.openingFloatCents, currency)} muted />
        <Row label="Cash sales" value={formatCents(report.salesByTender.cash, currency)} />
        <Row label="Card sales" value={formatCents(report.salesByTender.card, currency)} />
        <Row label="Other sales" value={formatCents(report.salesByTender.other, currency)} />
        {report.refundsCents > 0 && (
          <Row label="Refunds" value={`−${formatCents(report.refundsCents, currency)}`} muted />
        )}
        <Row label="Paid in" value={formatCents(report.paidInCents, currency)} muted />
        <Row label="Paid out" value={`−${formatCents(report.paidOutCents, currency)}`} muted />
      </div>

      <div className="border-t border-[#e6e3dc] mt-3 pt-3 text-sm space-y-1">
        <Row label="Gross sales" value={formatCents(report.grossCents, currency)} />
        <Row label="Net (after refunds)" value={formatCents(report.netCents, currency)} bold />
        <Row label="Transactions" value={String(report.transactionCount)} muted />
      </div>

      <div className="border-t border-[#e6e3dc] mt-3 pt-3 text-sm space-y-1">
        <Row label="Expected cash" value={formatCents(report.expectedCashCents, currency)} bold />
        {report.countedCashCents != null && (
          <>
            <Row label="Counted cash" value={formatCents(report.countedCashCents, currency)} bold />
            <Row
              label={report.varianceCents! >= 0 ? "Over" : "Short"}
              value={formatCents(Math.abs(report.varianceCents!), currency)}
              bold
            />
          </>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  bold,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${bold ? "font-semibold" : ""} ${
        muted ? "text-[#6b7169]" : ""
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
