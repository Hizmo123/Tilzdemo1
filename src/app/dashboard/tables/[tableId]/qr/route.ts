import { NextResponse, type NextRequest } from "next/server";
import { requireUser, getOwnedTable } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { qrPngBuffer, qrPrintableSvg } from "@/lib/qr";

// Serves the printable QR for a table as a download. Ownership is verified
// through getOwnedTable before anything is generated, so a guessed tableId from
// another tenant returns 404.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> },
) {
  const { tableId } = await params;
  const user = await requireUser();
  const table = await getOwnedTable(user.id, tableId);
  if (!table) {
    return new NextResponse("Not found", { status: 404 });
  }

  const activeToken = await prisma.qrToken.findFirst({
    where: { tableId: table.id, active: true },
    orderBy: { createdAt: "desc" },
  });
  if (!activeToken) {
    return new NextResponse("No active QR for this table", { status: 404 });
  }

  const format = request.nextUrl.searchParams.get("format") === "png"
    ? "png"
    : "svg";
  const safeLabel = table.label.replace(/[^a-zA-Z0-9-_]/g, "-");

  if (format === "png") {
    const png = await qrPngBuffer(activeToken.token);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="table-${safeLabel}-qr.png"`,
      },
    });
  }

  const svg = await qrPrintableSvg({
    token: activeToken.token,
    restaurantName: table.location.restaurant.name,
    tableLabel: table.label,
  });
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `attachment; filename="table-${safeLabel}-card.svg"`,
    },
  });
}
