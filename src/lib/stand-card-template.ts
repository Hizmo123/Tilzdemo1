import { PDFDocument, StandardFonts, rgb, type RGB } from "pdf-lib";
import { BRAND } from "@/lib/brand";

// A6 print-ready stand card, shared by the owner-facing live preview
// (dashboard/stands/card-preview.tsx renders the same layout in HTML/CSS)
// and the admin fulfilment download (qr-pack/route.ts, which calls this
// directly per stand and merges the pages into one print-ready PDF). One
// geometry definition, so the two can never drift apart.
//
// Coordinate convention used throughout this file: every mm figure is
// TRIM-LOCAL — (0,0) at the bottom-left of the 105x148mm trim box, y
// increasing upward, exactly as specified. The page itself is larger (trim +
// 3mm bleed on every edge), so trimPt()/trimX()/trimY() below add the bleed
// offset once, in one place, before handing a coordinate to pdf-lib (whose
// own origin is the bottom-left of the full bled page).

const MM_TO_PT = 2.834645669;
const mm = (v: number) => v * MM_TO_PT;

export const TRIM_WIDTH_MM = 105;
export const TRIM_HEIGHT_MM = 148;
export const BLEED_MM = 3;
export const PAGE_WIDTH_MM = TRIM_WIDTH_MM + BLEED_MM * 2;
export const PAGE_HEIGHT_MM = TRIM_HEIGHT_MM + BLEED_MM * 2;

const PAGE_WIDTH_PT = mm(PAGE_WIDTH_MM);
const PAGE_HEIGHT_PT = mm(PAGE_HEIGHT_MM);

type Palette = {
  bg: string;
  ink: string;
  muted: string;
  accent: string;
};

const PALETTES: Record<"dark" | "light", Palette> = {
  dark: { bg: "#0B0F0D", ink: "#FFFFFF", muted: "#9CA89F", accent: "#22C55E" },
  light: { bg: "#F7F5F0", ink: "#111412", muted: "#6B7570", accent: "#0F9D58" },
};

export type CardOptions = {
  palette: "dark" | "light";
  headlineText: string; // venue name OR "TAP-TO-IT"
  qr: { png: Buffer } | null; // null = draw the dashed placeholder instead
};

// Headline auto-fit: start at the design size and shrink (never grow) until
// the text fits within the trim width minus side margins, down to a floor
// past which it'd be illegible. Font metrics scale linearly with size, so
// one division gets the exact fitting size — no need to iterate/measure in a
// loop. Shared with card-preview.tsx's CSS version (same inputs, same floor)
// so the PDF and the live preview never disagree on where a headline wraps.
export const HEADLINE_MAX_PT = 26;
export const HEADLINE_MIN_PT = 14;
export const HEADLINE_MARGIN_MM = 12;

function fitHeadlineSize(
  font: { widthOfTextAtSize(text: string, size: number): number },
  text: string,
  maxWidthPt: number,
): number {
  const widthAtMax = font.widthOfTextAtSize(text, HEADLINE_MAX_PT);
  if (widthAtMax <= maxWidthPt) return HEADLINE_MAX_PT;
  return Math.max(HEADLINE_MIN_PT, HEADLINE_MAX_PT * (maxWidthPt / widthAtMax));
}

// The underline was authored as an 18mm bar under "TILLZ" set at 26pt — i.e.
// ~0.721x that string's rendered width, not a fixed span. Preserving that
// ratio (rather than a fixed mm width) is what keeps it looking intentional
// under a longer wordmark or venue name rather than comically short or wide.
const UNDERLINE_TO_TEXT_RATIO = 0.7209577522466513;

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// Rounded-rect path, authored in ordinary (0,0)-bottom-left, (w,h)-top-right
// local coordinates. IMPORTANT, verified empirically (not assumed) against
// this project's pinned pdf-lib 1.17.1 by rendering a controlled test with
// pdfjs-dist and comparing pixel-for-pixel against a trusted drawRectangle:
// drawSvgPath's `y` option does NOT behave like drawRectangle/drawImage's
// (bottom-left anchor). It anchors the TOP of the path's own local bounding
// box — i.e. for a path whose local y ranges [0, h], pass
// `y: <page-y where the local y=h edge should land>`, not the bottom. Every
// call site below computes and passes that top edge explicitly (see the
// comment at each one) rather than re-deriving this each time.
function roundedRectPath(wPt: number, hPt: number, rPt: number): string {
  const r = Math.min(rPt, wPt / 2, hPt / 2);
  return [
    `M ${r} 0`,
    `L ${wPt - r} 0`,
    `A ${r} ${r} 0 0 1 ${wPt} ${r}`,
    `L ${wPt} ${hPt - r}`,
    `A ${r} ${r} 0 0 1 ${wPt - r} ${hPt}`,
    `L ${r} ${hPt}`,
    `A ${r} ${r} 0 0 1 0 ${hPt - r}`,
    `L 0 ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    "Z",
  ].join(" ");
}

export async function renderStandCardPdf(opts: CardOptions): Promise<Uint8Array> {
  const palette = PALETTES[opts.palette];
  const bg = hexToRgb(palette.bg);
  const ink = hexToRgb(palette.ink);
  const muted = hexToRgb(palette.muted);
  const accent = hexToRgb(palette.accent);

  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);

  // trim-local mm -> page pt, in one place — every other coordinate in this
  // function is expressed relative to the trim box, never the bled page.
  const tx = (xMm: number) => mm(xMm + BLEED_MM);
  const ty = (yMm: number) => mm(yMm + BLEED_MM);
  const centerXMm = TRIM_WIDTH_MM / 2;

  const centerText = (text: string, font: typeof bold, size: number, yMm: number, color: RGB) => {
    const width = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: tx(centerXMm) - width / 2, y: ty(yMm), size, font, color });
  };

  // ---- Background (fills the whole bled page, not just the trim) --------
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH_PT, height: PAGE_HEIGHT_PT, color: bg });

  // ---- Headline (venue name or "TAP-TO-IT"), auto-fit to the trim width --
  const maxHeadlineWidthPt = mm(TRIM_WIDTH_MM - HEADLINE_MARGIN_MM * 2);
  const headlineSize = fitHeadlineSize(bold, opts.headlineText, maxHeadlineWidthPt);
  centerText(opts.headlineText, bold, headlineSize, TRIM_HEIGHT_MM - 20, accent);

  // ---- Underline, width proportional to the rendered headline width -----
  const headlineWidthPt = bold.widthOfTextAtSize(opts.headlineText, headlineSize);
  const underlineHalfWidthMm = (headlineWidthPt * UNDERLINE_TO_TEXT_RATIO) / MM_TO_PT / 2;
  const underlineY = TRIM_HEIGHT_MM - 23;
  page.drawLine({
    start: { x: tx(centerXMm - underlineHalfWidthMm), y: ty(underlineY) },
    end: { x: tx(centerXMm + underlineHalfWidthMm), y: ty(underlineY) },
    thickness: 1.4,
    color: accent,
  });

  // ---- QR outer tile: 52mm square, top edge at trimH - 32mm -------------
  const TILE_SIZE_MM = 52;
  const TILE_TOP_MM = TRIM_HEIGHT_MM - 32;
  const TILE_BOTTOM_MM = TILE_TOP_MM - TILE_SIZE_MM;
  const TILE_LEFT_MM = centerXMm - TILE_SIZE_MM / 2;
  const TILE_RADIUS_MM = 4;

  // Outer accent frame, 3mm beyond the tile on every side. A stroke only
  // (no fill) — the spec gives the offset, not a weight, so this uses the
  // same 1.4pt as the underline for visual consistency; adjust here if the
  // approved design wants something else.
  const FRAME_OFFSET_MM = 3;
  const frameSize = TILE_SIZE_MM + FRAME_OFFSET_MM * 2;
  // y is the shape's TOP edge (see roundedRectPath's doc comment) — the
  // frame's top sits FRAME_OFFSET_MM above the tile's own top.
  page.drawSvgPath(roundedRectPath(mm(frameSize), mm(frameSize), mm(TILE_RADIUS_MM + FRAME_OFFSET_MM)), {
    x: tx(TILE_LEFT_MM - FRAME_OFFSET_MM),
    y: ty(TILE_TOP_MM + FRAME_OFFSET_MM),
    borderColor: accent,
    borderWidth: 1.4,
  });

  // Tile itself: white fill, 4mm radius, 2.2pt accent border.
  page.drawSvgPath(roundedRectPath(mm(TILE_SIZE_MM), mm(TILE_SIZE_MM), mm(TILE_RADIUS_MM)), {
    x: tx(TILE_LEFT_MM),
    y: ty(TILE_TOP_MM),
    color: rgb(1, 1, 1),
    borderColor: accent,
    borderWidth: 2.2,
  });

  // ---- QR itself: inset 4mm -> 44x44mm, OR the placeholder --------------
  const QR_INSET_MM = 4;
  const QR_SIZE_MM = TILE_SIZE_MM - QR_INSET_MM * 2;
  const qrLeftMm = TILE_LEFT_MM + QR_INSET_MM;
  const qrBottomMm = TILE_BOTTOM_MM + QR_INSET_MM;

  if (opts.qr) {
    const embedded = await doc.embedPng(opts.qr.png);
    page.drawImage(embedded, {
      x: tx(qrLeftMm),
      y: ty(qrBottomMm),
      width: mm(QR_SIZE_MM),
      height: mm(QR_SIZE_MM),
    });
  } else {
    // Dashed placeholder box, inset slightly from the QR area so the dashes
    // read as "a box drawn inside the tile", matching the reference PDFs.
    const dashInsetMm = 2;
    const dashSize = QR_SIZE_MM - dashInsetMm * 2;
    page.drawRectangle({
      x: tx(qrLeftMm + dashInsetMm),
      y: ty(qrBottomMm + dashInsetMm),
      width: mm(dashSize),
      height: mm(dashSize),
      borderColor: muted,
      borderWidth: 1,
      borderDashArray: [4, 3],
    });
    centerText("QR CODE", bold, 11, qrBottomMm + QR_SIZE_MM / 2 + 3, muted);
    centerText("placeholder — swap per venue", regular, 7, qrBottomMm + QR_SIZE_MM / 2 - 6, muted);
  }

  // ---- "SCAN TO ORDER", fixed, 10mm below the tile -----------------------
  const scanToOrderY = TILE_BOTTOM_MM - 10;
  centerText("SCAN TO ORDER", bold, 13, scanToOrderY, ink);

  // ---- Order / Pay / Enjoy row --------------------------------------------
  // The spec fixes every other element's position precisely but gives this
  // row only its column/icon/label proportions, not an exact y — placed
  // here at a fixed distance below "SCAN TO ORDER" with room left above the
  // footer for the crop-mark/bleed margin. Adjust ROW_TOP_MM alone if the
  // approved design wants it moved.
  const ROW_TOP_MM = scanToOrderY - 14;
  const ICON_SIZE_MM = 9;
  const COLUMN_WIDTH_MM = TRIM_WIDTH_MM / 3;
  const ROW_STEPS: { label: string; icon: (cxMm: number, topMm: number) => void }[] = [
    {
      label: "ORDER",
      icon: (cxMm, topMm) => drawForkKnifeIcon(page, tx, ty, cxMm, topMm, ICON_SIZE_MM, ink),
    },
    {
      label: "PAY",
      icon: (cxMm, topMm) => drawCardIcon(page, tx, ty, cxMm, topMm, ICON_SIZE_MM, ink),
    },
    {
      label: "ENJOY",
      icon: (cxMm, topMm) => drawSmileyIcon(page, tx, ty, cxMm, topMm, ICON_SIZE_MM, ink),
    },
  ];
  ROW_STEPS.forEach((step, i) => {
    const colCenterMm = COLUMN_WIDTH_MM * i + COLUMN_WIDTH_MM / 2;
    step.icon(colCenterMm, ROW_TOP_MM);
    const labelWidth = bold.widthOfTextAtSize(step.label, 7.2);
    page.drawText(step.label, {
      x: tx(colCenterMm) - labelWidth / 2,
      y: ty(ROW_TOP_MM - ICON_SIZE_MM - 5),
      size: 7.2,
      font: bold,
      color: ink,
    });
    // Divider between columns (not after the last one).
    if (i < ROW_STEPS.length - 1) {
      const dividerXMm = COLUMN_WIDTH_MM * (i + 1);
      page.drawLine({
        start: { x: tx(dividerXMm), y: ty(ROW_TOP_MM - ICON_SIZE_MM - 8) },
        end: { x: tx(dividerXMm), y: ty(ROW_TOP_MM + 1) },
        thickness: 0.6,
        color: muted,
        opacity: 0.5,
      });
    }
  });

  // ---- Footer -------------------------------------------------------------
  centerText(BRAND.poweredBy, regular, 6.5, 6, muted);

  // ---- Crop marks + dashed trim guide -------------------------------------
  drawCropMarksAndGuide(page, tx, ty, muted);

  return doc.save();
}

// Small line-art icons, each centered on (cxMm, topMm) with the given
// footprint in mm — built from primitive shapes rather than embedded
// artwork, so the card template has no binary asset dependencies.
function drawForkKnifeIcon(
  page: import("pdf-lib").PDFPage,
  tx: (m: number) => number,
  ty: (m: number) => number,
  cxMm: number,
  topMm: number,
  sizeMm: number,
  color: RGB,
) {
  const left = cxMm - sizeMm / 2;
  const right = cxMm + sizeMm / 2;
  const bottom = topMm - sizeMm;
  const forkX = left + sizeMm * 0.28;
  // Fork: a short shaft with three tines.
  page.drawLine({ start: { x: tx(forkX), y: ty(bottom) }, end: { x: tx(forkX), y: ty(topMm - sizeMm * 0.35) }, thickness: 0.9, color });
  for (const dx of [-0.09, 0, 0.09]) {
    page.drawLine({
      start: { x: tx(forkX + dx * sizeMm), y: ty(topMm) },
      end: { x: tx(forkX + dx * sizeMm), y: ty(topMm - sizeMm * 0.35) },
      thickness: 0.7,
      color,
    });
  }
  // Knife: a shaft with a triangular blade along the top.
  const knifeX = right - sizeMm * 0.28;
  page.drawLine({ start: { x: tx(knifeX), y: ty(bottom) }, end: { x: tx(knifeX), y: ty(topMm - sizeMm * 0.4) }, thickness: 0.9, color });
  // This path's local y ranges [0, mm(sizeMm*0.4)] — its own max-y (the tip)
  // is what the drawSvgPath `y` option anchors, so pass the tip's intended
  // page position (topMm), not the blade's base.
  page.drawSvgPath(
    `M 0 0 L ${mm(sizeMm * 0.16)} ${mm(sizeMm * 0.05)} L 0 ${mm(sizeMm * 0.4)} Z`,
    { x: tx(knifeX), y: ty(topMm), color },
  );
}

function drawCardIcon(
  page: import("pdf-lib").PDFPage,
  tx: (m: number) => number,
  ty: (m: number) => number,
  cxMm: number,
  topMm: number,
  sizeMm: number,
  color: RGB,
) {
  const w = sizeMm;
  const h = sizeMm * 0.66;
  const left = cxMm - w / 2;
  const bottom = topMm - h;
  // y is the shape's TOP edge (see roundedRectPath's doc comment) — that's
  // this icon's own top, i.e. `topMm` itself.
  page.drawSvgPath(roundedRectPath(mm(w), mm(h), mm(1)), {
    x: tx(left),
    y: ty(topMm),
    borderColor: color,
    borderWidth: 0.9,
  });
  // The card's magnetic stripe.
  page.drawRectangle({
    x: tx(left),
    y: ty(bottom + h * 0.6),
    width: mm(w),
    height: mm(h * 0.16),
    color,
  });
}

function drawSmileyIcon(
  page: import("pdf-lib").PDFPage,
  tx: (m: number) => number,
  ty: (m: number) => number,
  cxMm: number,
  topMm: number,
  sizeMm: number,
  color: RGB,
) {
  const r = sizeMm / 2;
  const cy = topMm - r;
  page.drawEllipse({ x: tx(cxMm), y: ty(cy), xScale: mm(r), yScale: mm(r), borderColor: color, borderWidth: 0.9 });
  // Eyes.
  for (const dx of [-0.32, 0.32]) {
    page.drawEllipse({ x: tx(cxMm + dx * r), y: ty(cy + r * 0.25), xScale: mm(r * 0.09), yScale: mm(r * 0.09), color });
  }
  // Smile: a single quadratic-curve arc, level endpoints with the control
  // point pulling the middle upward. Sign verified by rendering — a naive
  // "dip below the endpoints" reading of the path's own y values renders as
  // a frown once drawSvgPath's y-anchoring (see roundedRectPath's doc
  // comment) is accounted for; this is the sign that actually smiles.
  page.drawSvgPath(
    `M ${-mm(r * 0.45)} 0 Q 0 ${mm(r * 0.5)} ${mm(r * 0.45)} 0`,
    { x: tx(cxMm), y: ty(cy - r * 0.15), borderColor: color, borderWidth: 0.8 },
  );
}

function drawCropMarksAndGuide(
  page: import("pdf-lib").PDFPage,
  tx: (m: number) => number,
  ty: (m: number) => number,
  color: RGB,
) {
  // Standard print crop marks: a short line either side of each trim corner,
  // extending from just outside the trim into the bleed, with a small gap
  // right at the corner itself so the marks never touch the artwork.
  const MARK_LEN_MM = 4;
  const GAP_MM = 1;
  const corners: { xMm: number; yMm: number; dx: -1 | 1; dy: -1 | 1 }[] = [
    { xMm: 0, yMm: 0, dx: -1, dy: -1 },
    { xMm: TRIM_WIDTH_MM, yMm: 0, dx: 1, dy: -1 },
    { xMm: 0, yMm: TRIM_HEIGHT_MM, dx: -1, dy: 1 },
    { xMm: TRIM_WIDTH_MM, yMm: TRIM_HEIGHT_MM, dx: 1, dy: 1 },
  ];
  for (const c of corners) {
    // Horizontal mark, offset from the corner's x by the gap, running further out.
    page.drawLine({
      start: { x: tx(c.xMm + c.dx * GAP_MM), y: ty(c.yMm) },
      end: { x: tx(c.xMm + c.dx * (GAP_MM + MARK_LEN_MM)), y: ty(c.yMm) },
      thickness: 0.5,
      color,
    });
    // Vertical mark.
    page.drawLine({
      start: { x: tx(c.xMm), y: ty(c.yMm + c.dy * GAP_MM) },
      end: { x: tx(c.xMm), y: ty(c.yMm + c.dy * (GAP_MM + MARK_LEN_MM)) },
      thickness: 0.5,
      color,
    });
  }

  // Dashed trim guide — the exact 105x148mm boundary, so a hand-trim or a
  // check against the die-line is unambiguous.
  page.drawRectangle({
    x: tx(0),
    y: ty(0),
    width: mm(TRIM_WIDTH_MM),
    height: mm(TRIM_HEIGHT_MM),
    borderColor: color,
    borderWidth: 0.4,
    borderDashArray: [3, 2],
    borderOpacity: 0.6,
  });
}
