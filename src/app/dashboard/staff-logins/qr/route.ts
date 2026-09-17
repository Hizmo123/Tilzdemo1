import { NextResponse, type NextRequest } from "next/server";
import { getAuthz } from "@/lib/auth";
import { appBaseUrl } from "@/lib/urls";
import { qrPngBufferForUrl, qrPrintableCardSvg } from "@/lib/qr";

// Serves a printable QR for the venue's staff sign-in page — same idea as a
// table QR, but pointed at /staff/[slug] instead of a table's visit link.
// Print it once and stick it at the venue; from then on staff scan it
// themselves, and the owner is never the bottleneck for getting someone
// signed in.
export async function GET(request: NextRequest) {
  const authz = await getAuthz();
  if (!authz.can("staff:manage")) {
    return new NextResponse("Not found", { status: 404 });
  }
  const restaurant = authz.membership?.organization.restaurants[0];
  if (!restaurant) {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = `${appBaseUrl()}/staff/${restaurant.slug}`;
  const format = request.nextUrl.searchParams.get("format") === "png" ? "png" : "svg";

  if (format === "png") {
    const png = await qrPngBufferForUrl(url, {
      foreground: restaurant.qrForegroundColor,
      background: restaurant.qrBackgroundColor,
    });
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="staff-login-qr.png"`,
      },
    });
  }

  const svg = await qrPrintableCardSvg({
    url,
    title: restaurant.name,
    cta: "STAFF SIGN IN",
    bottomLabel: "Scan, tap your name, enter PIN",
    footer: "Point your phone or the venue tablet's camera at the code",
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
      "Content-Disposition": `attachment; filename="staff-login-card.svg"`,
    },
  });
}
