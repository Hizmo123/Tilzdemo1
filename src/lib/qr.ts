import QRCode from "qrcode";
import { visitUrl, standUrl } from "@/lib/urls";

// Base URL + visit URL resolution live in @/lib/urls (shared with invite/auth
// links). Re-exported here so existing `@/lib/qr` imports keep working.
export { appBaseUrl, visitUrl } from "@/lib/urls";

// ---- Generic (any URL) ------------------------------------------------------

// A data URL for inline <img> preview in the dashboard.
export async function qrDataUrlForUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    margin: 1,
    width: 320,
    errorCorrectionLevel: "M",
  });
}

// High-resolution PNG bytes for printing (raw QR, no framing). Colour only —
// the qrcode package supports that natively for PNG; corner-shape and logo
// embedding need the module matrix directly (see qrStyledSvgForUrl below),
// which is SVG-only here.
export async function qrPngBufferForUrl(
  url: string,
  colors?: { foreground?: string | null; background?: string | null },
): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    width: 1024,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: safeHex(colors?.foreground, "#000000"),
      light: safeHex(colors?.background, "#ffffff"),
    },
  });
}

// ---- Physical stand QR export ------------------------------------------------
// A screen QR (qrDataUrlForUrl/qrPngBufferForUrl above) is tuned for a phone
// display: small, medium error correction, a 1-2 module quiet zone. None of
// that survives a real print run — a thin quiet zone gets trimmed by a
// printer's own margin handling and fails scans, and a centre logo/caption
// composited on later needs high error correction to still decode with a
// chunk of the code obscured. Deliberately a SEPARATE generator from the /v
// screen QR functions above — never reused for them, and they're never
// reused for this.

const STAND_QR_PRINT_OPTIONS = {
  width: 1200, // >=1000px at print resolution
  margin: 4, // quiet zone, in QR modules
  errorCorrectionLevel: "H" as const, // survives a centre logo/caption overlay
};

// Print-ready PNG for a physical Tillz stand's QR, encoding /s/<qrToken>
// (see lib/urls.ts#standUrl) — never a table's /v/<token> URL directly, so
// the stand can be activated onto (or later moved to) a different table
// with no reprint.
export async function standQrPng(qrToken: string): Promise<Buffer> {
  return QRCode.toBuffer(standUrl(qrToken), {
    type: "png",
    ...STAND_QR_PRINT_OPTIONS,
    color: { dark: "#000000", light: "#ffffff" },
  });
}

// Vector variant of the same print-ready stand QR — preferred for the admin
// fulfilment pack (lossless at any print size).
export async function standQrSvg(qrToken: string): Promise<string> {
  return QRCode.toString(standUrl(qrToken), {
    type: "svg",
    ...STAND_QR_PRINT_OPTIONS,
    color: { dark: "#000000", light: "#ffffff" },
  });
}

// ---- Styled QR rendering (A5) ------------------------------------------------
// The `qrcode` package's own SVG/PNG output combines every dark module into
// one flat path — enough for a plain code, but there's no way to single out
// just the three finder-pattern eyes for a rounded treatment, or to reserve
// clear space for a logo, without the actual module matrix. QRCode.create()
// exposes exactly that (a size + a flat 0/1 array), so the styled renderer
// below draws its own SVG from that matrix directly — no new dependency,
// just using more of the one already installed.

const HEX_RE = /^#[0-9a-f]{6}$/i;

export type QrStyleOptions = {
  foreground?: string | null;
  background?: string | null;
  cornerStyle?: string | null; // "square" | "rounded"
  logoDataUrl?: string | null; // embed a small logo in the centre when set
};

function safeHex(v: string | null | undefined, fallback: string): string {
  return v && HEX_RE.test(v) ? v : fallback;
}

export async function qrStyledSvgForUrl(url: string, opts: QrStyleOptions = {}): Promise<string> {
  const fg = safeHex(opts.foreground, "#15181b");
  const bg = safeHex(opts.background, "#ffffff");
  const rounded = opts.cornerStyle === "rounded";
  const embedLogo = !!opts.logoDataUrl;

  // A logo covers part of the code, so it needs high error correction (H —
  // tolerates ~30% damage) to still scan reliably; without one, M is plenty
  // and keeps the code a little less dense.
  const qr = QRCode.create(url, { errorCorrectionLevel: embedLogo ? "H" : "M" });
  const { size, data } = qr.modules;
  const scale = 8;
  const quiet = 2;
  const dim = (size + quiet * 2) * scale;

  const isDark = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < size && y < size && data[y * size + x] === 1;

  // The three finder "eyes" always sit at these fixed corners, always 7x7
  // modules, for every QR version — no need to detect them from pixel data.
  const finders = [
    { x: 0, y: 0 },
    { x: size - 7, y: 0 },
    { x: 0, y: size - 7 },
  ];
  const inFinder = (x: number, y: number) =>
    finders.some((f) => x >= f.x && x < f.x + 7 && y >= f.y && y < f.y + 7);

  // A logo sits in the centre with a background-coloured pad so it stays
  // legible against whatever's beneath it — modules under that pad are
  // skipped entirely (the H-level error correction is what makes this safe).
  const logoFrac = 0.22;
  const logoPx = dim * logoFrac;
  const logoPad = logoPx * 0.14;
  const logoBoxStart = (dim - logoPx) / 2 - logoPad;
  const logoBoxSize = logoPx + logoPad * 2;
  const inLogoBox = (x: number, y: number) => {
    if (!embedLogo) return false;
    const px = (x + quiet) * scale;
    const py = (y + quiet) * scale;
    return (
      px + scale > logoBoxStart &&
      px < logoBoxStart + logoBoxSize &&
      py + scale > logoBoxStart &&
      py < logoBoxStart + logoBoxSize
    );
  };

  let modules = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isDark(x, y)) continue;
      if (rounded && inFinder(x, y)) continue; // finders drawn as their own shapes below
      if (inLogoBox(x, y)) continue;
      const px = (x + quiet) * scale;
      const py = (y + quiet) * scale;
      modules += `<rect x="${px}" y="${py}" width="${scale}" height="${scale}"/>`;
    }
  }

  let finderShapes = "";
  if (rounded) {
    for (const f of finders) {
      const px = (f.x + quiet) * scale;
      const py = (f.y + quiet) * scale;
      const s7 = 7 * scale;
      finderShapes += `
        <rect x="${px}" y="${py}" width="${s7}" height="${s7}" rx="${scale * 1.8}" fill="${fg}"/>
        <rect x="${px + scale}" y="${py + scale}" width="${scale * 5}" height="${scale * 5}" rx="${scale * 1.3}" fill="${bg}"/>
        <rect x="${px + scale * 2}" y="${py + scale * 2}" width="${scale * 3}" height="${scale * 3}" rx="${scale * 0.8}" fill="${fg}"/>`;
    }
  }

  let logoShape = "";
  if (embedLogo && opts.logoDataUrl) {
    const logoXY = (dim - logoPx) / 2;
    logoShape = `
      <rect x="${logoBoxStart}" y="${logoBoxStart}" width="${logoBoxSize}" height="${logoBoxSize}" rx="${logoPad}" fill="${bg}"/>
      <image href="${opts.logoDataUrl}" x="${logoXY}" y="${logoXY}" width="${logoPx}" height="${logoPx}" preserveAspectRatio="xMidYMid slice"/>`;
  }

  // Square finders are already included in `modules` above (only skipped
  // there when `rounded`, in which case `finderShapes` draws them instead).
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}">
  <rect width="${dim}" height="${dim}" fill="${bg}"/>
  <g fill="${fg}">${modules}</g>
  ${finderShapes}
  ${logoShape}
</svg>`;
}

export async function qrStyledDataUrlForUrl(url: string, opts: QrStyleOptions = {}): Promise<string> {
  const svg = await qrStyledSvgForUrl(url, opts);
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// ---- Printable table-card templates -----------------------------------------
// Three layouts (spec A5), all pulling the venue's own theme/logo/QR style
// automatically rather than being separately configured. Card is a fixed
// 420x560 unit canvas so it prints at a consistent size regardless of which
// template is chosen.

export type CardTemplate = "minimal" | "branded" | "bold";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function qrPrintableCardSvg(opts: {
  url: string;
  title: string;
  cta: string;
  bottomLabel: string;
  footer: string;
  template?: CardTemplate;
  qrStyle?: QrStyleOptions;
  accentColor?: string | null;
  logoDataUrl?: string | null;
}): Promise<string> {
  const { url, title, cta, bottomLabel, footer } = opts;
  const template = opts.template ?? "branded";
  const accent = safeHex(opts.accentColor, "#0f5c42");
  const qrStyle: QrStyleOptions = {
    ...opts.qrStyle,
    logoDataUrl: opts.qrStyle?.logoDataUrl ?? (template === "branded" ? opts.logoDataUrl : null),
  };

  const qrSize = template === "bold" ? 260 : 300;
  const qrSvgRaw = await qrStyledSvgForUrl(url, qrStyle);
  const viewBoxMatch = qrSvgRaw.match(/viewBox="([^"]+)"/);
  const qrViewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 200 200";
  const innerMatch = qrSvgRaw.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  const qrInner = innerMatch ? innerMatch[1] : "";
  const qrX = (420 - qrSize) / 2;

  if (template === "minimal") {
    const qrY = 130;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="560" viewBox="0 0 420 560" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
  <rect width="420" height="560" fill="#ffffff" stroke="#e6e3dc" stroke-width="1"/>
  <svg x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" viewBox="${qrViewBox}">${qrInner}</svg>
  <text x="210" y="${qrY + qrSize + 50}" text-anchor="middle" font-size="20" font-weight="600" fill="#15181b">${esc(bottomLabel)}</text>
</svg>`;
  }

  if (template === "bold") {
    const qrY = 200;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="560" viewBox="0 0 420 560" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
  <rect width="420" height="560" rx="20" fill="${accent}"/>
  <text x="210" y="80" text-anchor="middle" font-size="15" font-weight="700" letter-spacing="3" fill="#ffffff" opacity="0.85">${esc(cta)}</text>
  <rect x="${qrX - 20}" y="${qrY - 20}" width="${qrSize + 40}" height="${qrSize + 40}" rx="16" fill="#ffffff"/>
  <svg x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" viewBox="${qrViewBox}">${qrInner}</svg>
  <text x="210" y="${qrY + qrSize + 70}" text-anchor="middle" font-size="26" font-weight="800" fill="#ffffff">${esc(bottomLabel)}</text>
  <text x="210" y="${qrY + qrSize + 98}" text-anchor="middle" font-size="12" fill="#ffffff" opacity="0.75">${esc(footer)}</text>
</svg>`;
  }

  // "branded" — the original layout (title + CTA + QR + label + footer),
  // now theme-aware via accentColor and QR style instead of hardcoded pine.
  const qrY = 150;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="560" viewBox="0 0 420 560" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
  <rect width="420" height="560" rx="20" fill="#ffffff" stroke="#e6e3dc" stroke-width="2"/>
  <text x="210" y="70" text-anchor="middle" font-size="26" font-weight="700" fill="#15181b">${esc(title)}</text>
  <text x="210" y="108" text-anchor="middle" font-size="15" font-weight="600" letter-spacing="2" fill="${accent}">${esc(cta)}</text>
  <svg x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" viewBox="${qrViewBox}">${qrInner}</svg>
  <text x="210" y="510" text-anchor="middle" font-size="20" font-weight="600" fill="#3a4147">${esc(bottomLabel)}</text>
  <text x="210" y="536" text-anchor="middle" font-size="11" fill="#6b7169">${esc(footer)}</text>
</svg>`;
}

// ---- Table visit tokens (existing behaviour, unchanged) --------------------

export async function qrDataUrl(token: string): Promise<string> {
  return qrDataUrlForUrl(visitUrl(token));
}

export async function qrPngBuffer(
  token: string,
  colors?: { foreground?: string | null; background?: string | null },
): Promise<Buffer> {
  return qrPngBufferForUrl(visitUrl(token), colors);
}

export async function qrPrintableSvg(opts: {
  token: string;
  restaurantName: string;
  tableLabel: string;
  template?: CardTemplate;
  qrStyle?: QrStyleOptions;
  accentColor?: string | null;
  logoDataUrl?: string | null;
}): Promise<string> {
  return qrPrintableCardSvg({
    url: visitUrl(opts.token),
    title: opts.restaurantName,
    cta: "SCAN TO ORDER & PAY",
    bottomLabel: `TABLE ${opts.tableLabel}`,
    footer: "Point your phone camera at the code",
    template: opts.template,
    qrStyle: opts.qrStyle,
    accentColor: opts.accentColor,
    logoDataUrl: opts.logoDataUrl,
  });
}
