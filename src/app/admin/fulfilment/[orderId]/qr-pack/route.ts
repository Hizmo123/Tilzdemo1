import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { getFulfilmentOrder } from "@/lib/admin/queries";
import { standQrPng } from "@/lib/qr";
import { createZip, type ZipEntry } from "@/lib/zip";

// A route handler, not a server action, for the same reason every other
// file-download in this app (CSV export, table QR download) is one — a
// server action is RPC-style and can't hand the browser a native
// Content-Disposition download the way a GET response can.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  await requirePlatformAdmin(); // re-checked independently of the layout — see lib/platform-admin.ts

  const { orderId } = await params;
  const order = await getFulfilmentOrder(orderId);
  if (!order) return new NextResponse("Not found", { status: 404 });

  const entries: ZipEntry[] = [];
  for (const item of order.items) {
    if (!item.stand) continue;
    const png = await standQrPng(item.stand.qrToken);
    // Filename carries the SERIAL + TABLE LABEL, exactly so a print run of
    // 20 stands doesn't get mixed up — see Task 4's own requirement.
    const tableLabel = item.table.label.replace(/[^a-zA-Z0-9-]/g, "_");
    entries.push({
      name: `${item.stand.serial}_Table-${tableLabel}.png`,
      data: png,
    });
  }

  const zip = createZip(entries);
  const filename = `${order.restaurant.slug}-stand-qr-pack.zip`;

  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
