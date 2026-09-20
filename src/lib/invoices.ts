import { prisma } from "@/lib/prisma";
import { addDays } from "@/lib/time";
import type { ResolvedRange } from "@/lib/date-range";
import type { BillChannel } from "@prisma/client";

// Loose "does this search term look like it's asking for a channel" match —
// e.g. typing "counter" in the invoices search box should surface counter
// sales alongside any table/name/email match, not just an exact enum value.
function matchingChannels(search: string): BillChannel[] {
  const q = search.trim().toLowerCase();
  if (!q) return [];
  const out: BillChannel[] = [];
  if (q.includes("counter") || "counter".includes(q)) out.push("COUNTER");
  if (q.includes("dine") || q.includes("table") || "dine in".includes(q)) out.push("DINE_IN");
  if (q.includes("takeaway") || q.includes("take away") || "takeaway".includes(q)) out.push("TAKEAWAY");
  return out;
}

export type InvoiceRow = {
  id: string;
  paidAt: Date | null;
  tableLabel: string;
  customerName: string | null;
  totalCents: number;
  tipCents: number;
  receiptEmail: string | null;
  receiptEmailSentAt: Date | null;
};

const MAX_ROWS = 200;

// Paid bills for a location within a range, most recent first, capped at
// MAX_ROWS — this is a review/search tool, not a full ledger export (use the
// CSV export for that, which streams without the cap).
export async function getInvoices(
  locationId: string,
  range: ResolvedRange,
  search?: string,
): Promise<{ rows: InvoiceRow[]; truncated: boolean }> {
  const channelMatches = search ? matchingChannels(search) : [];
  const bills = await prisma.bill.findMany({
    where: {
      locationId,
      status: "PAID",
      paidAt: { gte: range.from, lt: range.to },
      ...(search
        ? {
            OR: [
              { table: { label: { contains: search, mode: "insensitive" } } },
              { customerName: { contains: search, mode: "insensitive" } },
              { receiptEmail: { contains: search, mode: "insensitive" } },
              ...(channelMatches.length ? [{ channel: { in: channelMatches } }] : []),
            ],
          }
        : {}),
    },
    orderBy: { paidAt: "desc" },
    take: MAX_ROWS + 1,
    select: {
      id: true,
      paidAt: true,
      customerName: true,
      totalCents: true,
      tipCents: true,
      receiptEmail: true,
      receiptEmailSentAt: true,
      table: { select: { label: true } },
    },
  });

  const truncated = bills.length > MAX_ROWS;
  return {
    truncated,
    rows: bills.slice(0, MAX_ROWS).map((b) => ({
      id: b.id,
      paidAt: b.paidAt,
      tableLabel: b.table?.label ?? "Counter",
      customerName: b.customerName,
      totalCents: b.totalCents,
      tipCents: b.tipCents,
      receiptEmail: b.receiptEmail,
      receiptEmailSentAt: b.receiptEmailSentAt,
    })),
  };
}

export const RECENT_INVOICES_DAYS = 14;

export function recentInvoicesRange(): ResolvedRange {
  const now = new Date();
  return {
    from: addDays(now, -RECENT_INVOICES_DAYS),
    to: addDays(now, 1),
    label: `Last ${RECENT_INVOICES_DAYS} days`,
  };
}

// Streams every paid bill in a range as CSV rows — no MAX_ROWS cap, since
// this is the actual record-keeping export, not the on-screen review list.
export async function getInvoicesForExport(locationId: string, range: ResolvedRange) {
  return prisma.bill.findMany({
    where: { locationId, status: "PAID", paidAt: { gte: range.from, lt: range.to } },
    orderBy: { paidAt: "asc" },
    select: {
      id: true,
      paidAt: true,
      customerName: true,
      customerPhone: true,
      currency: true,
      subtotalCents: true,
      totalCents: true,
      tipCents: true,
      receiptEmail: true,
      table: { select: { label: true } },
    },
  });
}
