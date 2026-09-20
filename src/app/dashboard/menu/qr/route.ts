import { NextResponse, type NextRequest } from "next/server";
import { getAuthz } from "@/lib/auth";
import { appBaseUrl } from "@/lib/urls";
import { qrPngBufferForUrl, qrPrintableCardSvg } from "@/lib/qr";

// Serves a printable QR for the venue's single public menu page
// (/m/[slug]) — same idea as a table QR or the staff sign-in QR
// (dashboard/staff-logins/qr/route.ts), but pointed at the one menu link
// every table shares. Print it once, put it on every table.
export async function GET(request: NextRequest) {
  const authz = await getAuthz();
  if (!authz.can("menu:availability")) {
    return new NextResponse("Not found", { status: 404 });
  }
  const restaurant = authz.membership?.organization.restaurants[0];
  if (!restaurant) {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = `${appBaseUrl()}/m/${restaurant.slug}`;
  const format = request.nextUrl.searchParams.get("format") === "png" ? "png" : "svg";

  if (format === "png") {
    const png = await qrPngBufferForUrl(url, {
      foreground: restaurant.qrForegroundColor,
      background: restaurant.qrBackgroundColor,
    });
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="menu-qr.png"`,
      },
    });
  }

  const svg = await qrPrintableCardSvg({
    url,
    title: restaurant.name,
    cta: "VIEW MENU",
    bottomLabel: "Scan to see our menu",
    footer: "One code for every table",
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
      "Content-Disposition": `attachment; filename="menu-qr-card.svg"`,
    },
  });
}
