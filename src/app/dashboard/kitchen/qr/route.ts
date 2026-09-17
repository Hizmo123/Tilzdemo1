import { NextResponse, type NextRequest } from "next/server";
import { getAuthz } from "@/lib/auth";
import { appBaseUrl } from "@/lib/urls";
import { qrPngBufferForUrl, qrPrintableCardSvg } from "@/lib/qr";

// Serves a printable/scannable QR for the venue's kitchen screen — same
// generation code as the staff sign-in and table QRs, just pointed at
// /staff/[slug]/kitchen. Scan it on the tablet once; while its 12-hour staff
// session stays valid, opening it again goes straight to the board.
export async function GET(request: NextRequest) {
  const authz = await getAuthz();
  if (!authz.can("kitchen:manage")) {
    return new NextResponse("Not found", { status: 404 });
  }
  const restaurant = authz.membership?.organization.restaurants[0];
  if (!restaurant) {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = `${appBaseUrl()}/staff/${restaurant.slug}/kitchen`;
  const format = request.nextUrl.searchParams.get("format") === "png" ? "png" : "svg";

  if (format === "png") {
    const png = await qrPngBufferForUrl(url, {
      foreground: restaurant.qrForegroundColor,
      background: restaurant.qrBackgroundColor,
    });
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="kitchen-screen-qr.png"`,
      },
    });
  }

  const svg = await qrPrintableCardSvg({
    url,
    title: restaurant.name,
    cta: "KITCHEN SCREEN",
    bottomLabel: "Scan on the tablet",
    footer: "Signs in with your staff PIN the first time",
    template: restaurant.qrCardTemplate as "minimal" | "branded" | "bold",
    accentColor: restaurant.brandColor,
    logoDataUrl: restaurant.qrEmbedLogo ? restaurant.logoUrl : null,
    qrStyle: {
      foreground: restaurant.qrForegroundColor,
      background: restaurant.qrBackgroundColor,
      cornerStyle: restaurant.qrCornerStyle,
    },
  });
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `attachment; filename="kitchen-screen-card.svg"`,
    },
  });
}
