import QRCode from "qrcode";
import { visitUrl } from "@/lib/urls";

// Base URL + visit URL resolution live in @/lib/urls (shared with invite/auth
// links). Re-exported here so existing `@/lib/qr` imports keep working.
export { appBaseUrl, visitUrl } from "@/lib/urls";

// A data URL for inline <img> preview in the dashboard.
export async function qrDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(visitUrl(token), {
    margin: 1,
    width: 320,
    errorCorrectionLevel: "M",
  });
}

// High-resolution PNG bytes for printing (raw QR, no framing).
export async function qrPngBuffer(token: string): Promise<Buffer> {
  return QRCode.toBuffer(visitUrl(token), {
    type: "png",
    width: 1024,
    margin: 2,
    errorCorrectionLevel: "M",
  });
}

// A print-ready SVG "table card": QR plus the restaurant name, a call to action,
// and the table label. Composed by embedding the QR's own SVG paths inside a
// framed layout, so it scales cleanly to any print size.
export async function qrPrintableSvg(opts: {
  token: string;
  restaurantName: string;
  tableLabel: string;
}): Promise<string> {
  const { token, restaurantName, tableLabel } = opts;

  // qrcode emits a full <svg> document; extract its inner content and viewBox so
  // we can place it inside our own frame at an exact position and size.
  const rawSvg = await QRCode.toString(visitUrl(token), {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
  });

  const viewBoxMatch = rawSvg.match(/viewBox="([^"]+)"/);
  const qrViewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 25 25";
  const innerMatch = rawSvg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  const qrInner = innerMatch ? innerMatch[1] : "";

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Card is 420 x 560 units. QR sits in a 300 x 300 box, centred.
  const qrSize = 300;
  const qrX = (420 - qrSize) / 2;
  const qrY = 150;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="560" viewBox="0 0 420 560" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
  <rect width="420" height="560" rx="20" fill="#ffffff" stroke="#e6e3dc" stroke-width="2"/>
  <text x="210" y="70" text-anchor="middle" font-size="26" font-weight="700" fill="#15181b">${esc(
    restaurantName,
  )}</text>
  <text x="210" y="108" text-anchor="middle" font-size="15" font-weight="600" letter-spacing="2" fill="#0f5c42">SCAN TO ORDER &amp; PAY</text>
  <svg x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" viewBox="${qrViewBox}">${qrInner}</svg>
  <text x="210" y="510" text-anchor="middle" font-size="20" font-weight="600" fill="#3a4147">TABLE ${esc(
    tableLabel,
  )}</text>
  <text x="210" y="536" text-anchor="middle" font-size="11" fill="#6b7169">Point your phone camera at the code</text>
</svg>`;
}
