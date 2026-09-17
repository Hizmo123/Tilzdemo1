import Link from "next/link";
import { formatCents } from "@/lib/money";
import type { InvoiceRow } from "@/lib/invoices";

export function InvoiceListRow({ row, currency }: { row: InvoiceRow; currency: string }) {
  return (
    <Link
      href={`/receipt/${row.id}`}
      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper transition-colors"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">Table {row.tableLabel}</p>
        <p className="text-xs text-muted">
          {row.paidAt
            ? new Date(row.paidAt).toLocaleString("en-AU", {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : "—"}
          {row.receiptEmailSentAt && (
            <span className="text-pine-deep"> · emailed to {row.receiptEmail}</span>
          )}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-medium tabular-nums">
          {formatCents(row.totalCents, currency)}
        </p>
        {row.tipCents > 0 && (
          <p className="text-xs text-muted tabular-nums">
            incl. {formatCents(row.tipCents, currency)} tip
          </p>
        )}
      </div>
    </Link>
  );
}
