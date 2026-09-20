import { NextResponse } from "next/server";
import { getActiveLocation } from "@/lib/auth";
import { getInvoicesForExport } from "@/lib/invoices";
import { parseRangeParams } from "@/lib/date-range";
import { formatCents } from "@/lib/money";

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(request: Request) {
  const ctx = await getActiveLocation();
  if (!ctx) return NextResponse.json({ error: "No restaurant." }, { status: 404 });

  const url = new URL(request.url);
  const { resolved } = parseRangeParams(
    {
      range: url.searchParams.get("range") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    },
    ctx.restaurant.timezone,
  );

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
