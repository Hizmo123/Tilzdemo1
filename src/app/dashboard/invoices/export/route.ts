import { NextResponse } from "next/server";
import { getAuthz, getActiveLocation } from "@/lib/auth";
import { getEntitlements } from "@/lib/entitlements";
import { getInvoicesForExport } from "@/lib/invoices";
import { parseRangeParams, clampRangeToWindow } from "@/lib/date-range";
import { formatCents } from "@/lib/money";

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// A Route Handler is NOT wrapped by dashboard/invoices/layout.tsx's
// requireOrdering() — that only protects the page. This was this app's
// only dashboard route under src/app/dashboard/ with zero getAuthz/
// authz.can usage at all, and zero plan-window clamp: GET with a wide
// enough ?from=/&to= returned every paid bill's customer name, phone and
// receipt email as CSV, for any signed-in member, regardless of plan.
// Brought in line with every other analytics surface (see
// dashboard/analytics/page.tsx, dashboard/bills/page.tsx): permission
// check first, then clamp the RANGE ITSELF against the plan's window
// before it ever reaches the query — out-of-window rows are never
// fetched, not fetched-then-hidden.
export async function GET(request: Request) {
  const [authz, ctx] = await Promise.all([getAuthz(), getActiveLocation()]);
  if (!authz.can("bills:view")) {
    return NextResponse.json({ error: "Not permitted." }, { status: 403 });
  }
  if (!ctx) return NextResponse.json({ error: "No restaurant." }, { status: 404 });

  const url = new URL(request.url);
  const { resolved: requested } = parseRangeParams(
    {
      range: url.searchParams.get("range") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    },
    ctx.restaurant.timezone,
  );
  const ent = await getEntitlements(ctx.membership.organizationId);
  const { resolved } = clampRangeToWindow(requested, ent.analyticsWindowDays, ctx.restaurant.timezone);

  const bills = await getInvoicesForExport(ctx.location.id, resolved);

  const header = [
    "Date paid",
    "Table",
    "Customer name",
    "Customer phone",
    "Subtotal",
    "Tip",
    "Total",
    "Currency",
    "Receipt emailed to",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const b of bills) {
    lines.push(
      [
        b.paidAt ? new Date(b.paidAt).toISOString() : "",
        b.table?.label ?? "Counter",
        b.customerName ?? "",
        b.customerPhone ?? "",
        formatCents(b.subtotalCents, b.currency),
        formatCents(b.tipCents, b.currency),
        formatCents(b.totalCents, b.currency),
        b.currency,
        b.receiptEmail ?? "",
      ]
        .map((v) => csvCell(String(v)))
        .join(","),
    );
  }

  const csv = lines.join("\n");
  const filename = `invoices-${resolved.from.toISOString().slice(0, 10)}-to-${new Date(
    resolved.to.getTime() - 1,
  )
    .toISOString()
    .slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
