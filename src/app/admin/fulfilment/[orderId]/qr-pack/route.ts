import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { getFulfilmentOrder } from "@/lib/admin/queries";
import { standQrPng } from "@/lib/qr";
import { renderStandCardPdf } from "@/lib/stand-card-template";
import { createZip, type ZipEntry } from "@/lib/zip";

// A route handler, not a server action, for the same reason every other
// file-download in this app (CSV export, table QR download) is one — a
// server action is RPC-style and can't hand the browser a native
// Content-Disposition download the way a GET response can.
//
// Two formats, chosen via ?format=:
// - (default) "pdf" — the actual print pack: one composited A6 card per
//   minted stand (lib/stand-card-template.ts), combined into a single
//   multi-page PDF via pdf-lib document merging. This is what goes to a
//   printer.
// - "zip" — the older raw-PNG-per-stand download, kept as a secondary
//   option rather than removed, for whoever just wants the bare QR images.
//
// Only orders whose product shipped with a card insert get the PDF at all
// (hasCardInsertSnapshot, taken at order time — the live product may since
// have been edited or retired). Without an insert there's no card to
// composite, so the zip is the only format, whatever ?format= says.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  await requirePlatformAdmin(); // re-checked independently of the layout — see lib/platform-admin.ts

  const { orderId } = await params;
  const order = await getFulfilmentOrder(orderId);
  if (!order) return new NextResponse("Not found", { status: 404 });

  const mintedItems = order.items.filter((item) => item.stand);
  if (mintedItems.length === 0) {
    return new NextResponse("No stands have been minted for this order yet.", { status: 409 });
  }

  const format = new URL(request.url).searchParams.get("format");

  if (!order.hasCardInsertSnapshot && format === "pdf") {
    return new NextResponse("This product has no card insert — download the raw QR codes instead.", {
      status: 409,
    });
  }

  if (format === "zip" || !order.hasCardInsertSnapshot) {
    const entries: ZipEntry[] = [];
    for (const item of mintedItems) {
      const png = await standQrPng(item.stand!.qrToken);
      // Filename carries the SERIAL + TABLE LABEL, exactly so a print run of
      // 20 stands doesn't get mixed up — see Task 4's own requirement.
      const tableLabel = item.table.label.replace(/[^a-zA-Z0-9-]/g, "_");
      entries.push({
        name: `${item.stand!.serial}_Table-${tableLabel}.png`,
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

  const palette = order.cardTemplate === "LIGHT" ? "light" : "dark";
  const headlineText = order.cardHeadlineMode === "VENUE_NAME" ? order.restaurant.name : "TILLZ";

  const pack = await PDFDocument.create();
  for (const item of mintedItems) {
    const qrPng = await standQrPng(item.stand!.qrToken);
    const cardBytes = await renderStandCardPdf({
      palette,
      headlineText,
      qr: { png: Buffer.from(qrPng) },
    });
    const cardDoc = await PDFDocument.load(cardBytes);
    const [page] = await pack.copyPages(cardDoc, [0]);
    pack.addPage(page);
  }

  const pdfBytes = await pack.save();
  const filename = `${order.restaurant.slug}-stand-print-pack.pdf`;

  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
