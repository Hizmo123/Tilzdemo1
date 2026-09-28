"use client";

// Live HTML/CSS approximation of the printed A6 stand card (see
// src/lib/stand-card-template.ts for the actual print-ready PDF this
// mirrors). Positions below are the same mm measurements from that module,
// converted to percentages of the trim box (105 x 148mm) — since the
// preview's aspect-ratio is locked to 105/148, a width-% and a height-%
// derived from the same mm value render as the same pixel length, so a
// "52mm square" tile stays square regardless of the preview's own size.
const TRIM_W = 105;
const TRIM_H = 148;

const pctX = (mm: number) => `${(mm / TRIM_W) * 100}%`;
const pctY = (mm: number) => `${(mm / TRIM_H) * 100}%`;

const PALETTES = {
  dark: { bg: "#0B0F0D", ink: "#FFFFFF", muted: "#9CA89F", accent: "#22C55E" },
  light: { bg: "#F7F5F0", ink: "#111412", muted: "#6B7570", accent: "#0F9D58" },
} as const;

export type CardPalette = keyof typeof PALETTES;

// Geometry, ported 1:1 from stand-card-template.ts's own constants (measured
// from the trim box's top edge here, since CSS positions down from the top).
const TILE_SIZE = 52;
const TILE_TOP = 32;
const TILE_LEFT = (TRIM_W - TILE_SIZE) / 2;
const FRAME_OFFSET = 3;
const FRAME_SIZE = TILE_SIZE + FRAME_OFFSET * 2;
const FRAME_TOP = TILE_TOP - FRAME_OFFSET;
const FRAME_LEFT = TILE_LEFT - FRAME_OFFSET;
const QR_INSET = 4;
const QR_SIZE = TILE_SIZE - QR_INSET * 2;
const SCAN_Y = TILE_TOP + TILE_SIZE + 10;
const ROW_TOP = SCAN_Y + 4;
const ICON_SIZE = 9;
const COLUMN_W = TRIM_W / 3;

const STEPS: { label: string; icon: (color: string) => React.ReactNode }[] = [
  {
    label: "ORDER",
    icon: (color) => (
      <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round">
        <path d="M6 3v8M4 3v4a2 2 0 0 0 4 0V3M6 11v10" />
        <path d="M17 3c-2 0-3 2.5-3 5.5S15 12 17 12v9" />
      </svg>
    ),
  },
  {
    label: "PAY",
    icon: (color) => (
      <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6}>
        <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
        <path d="M2.5 9.5h19" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "ENJOY",
    icon: (color) => (
      <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6}>
        <circle cx="12" cy="12" r="9.5" />
        <circle cx="8.7" cy="10" r="1" fill={color} stroke="none" />
        <circle cx="15.3" cy="10" r="1" fill={color} stroke="none" />
        <path d="M8 14.5c1 1.4 2.4 2 4 2s3-.6 4-2" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function CardPreview({
  palette,
  headlineText,
}: {
  palette: CardPalette;
  headlineText: string;
}) {
  const c = PALETTES[palette];

  return (
    <div
      className="relative w-full overflow-hidden rounded-[var(--radius-md)] border border-line shadow-sm select-none"
      style={{
        aspectRatio: `${TRIM_W} / ${TRIM_H}`,
        background: c.bg,
        containerType: "inline-size",
      }}
    >
      {/* Headline */}
      <div
        className="absolute left-0 right-0 text-center font-display font-bold"
        style={{ top: pctY(14), color: c.accent, fontSize: "clamp(10px, 8.2cqw, 22px)" }}
      >
        {headlineText}
      </div>

      {/* Underline */}
      <div
        className="absolute"
        style={{
          top: pctY(19),
          left: pctX(TRIM_W / 2 - 9),
          width: pctX(18),
          height: 1.5,
          background: c.accent,
        }}
      />

      {/* Outer accent frame */}
      <div
        className="absolute rounded-[8%]"
        style={{
          top: pctY(FRAME_TOP),
          left: pctX(FRAME_LEFT),
          width: pctX(FRAME_SIZE),
          height: pctY(FRAME_SIZE),
          border: `1.5px solid ${c.accent}`,
        }}
      />

      {/* QR tile */}
      <div
        className="absolute rounded-[8%] bg-white"
        style={{
          top: pctY(TILE_TOP),
          left: pctX(TILE_LEFT),
          width: pctX(TILE_SIZE),
          height: pctY(TILE_SIZE),
          border: `2px solid ${c.accent}`,
        }}
      >
        {/* Inset QR area, positioned as a % of the tile itself (not the
            trim box) since QR_INSET/QR_SIZE are measured from the tile's
            own edges. No real QR exists pre-payment — this always shows
            the placeholder, never a fake code. */}
        <div
          className="absolute flex items-center justify-center text-center leading-tight border border-dashed rounded-[6%]"
          style={{
            top: `${(QR_INSET / TILE_SIZE) * 100}%`,
            left: `${(QR_INSET / TILE_SIZE) * 100}%`,
            width: `${(QR_SIZE / TILE_SIZE) * 100}%`,
            height: `${(QR_SIZE / TILE_SIZE) * 100}%`,
            borderColor: "#c9c9c9",
            color: "#9a9a9a",
            fontSize: "clamp(6px, 2.6cqw, 9px)",
          }}
        >
          QR CODE
          <br />
          added after you order
        </div>
      </div>

      {/* SCAN TO ORDER */}
      <div
        className="absolute left-0 right-0 text-center font-bold"
        style={{ top: pctY(SCAN_Y), color: c.ink, fontSize: "clamp(7px, 3.4cqw, 12px)" }}
      >
        SCAN TO ORDER
      </div>

      {/* Order / Pay / Enjoy row */}
      <div className="absolute left-0 right-0 flex" style={{ top: pctY(ROW_TOP) }}>
        {STEPS.map((step, i) => (
          <div
            key={step.label}
            className="flex-1 flex flex-col items-center relative"
            style={{ width: pctX(COLUMN_W) }}
          >
            {i > 0 && (
              <div
                className="absolute left-0 top-0 bottom-0"
                style={{ width: 1, background: c.muted, opacity: 0.35 }}
              />
            )}
            <div style={{ width: pctX(ICON_SIZE), height: pctY(ICON_SIZE) }}>
              {step.icon(c.accent)}
            </div>
            <div
              className="font-bold tracking-wide mt-1"
              style={{ color: c.ink, fontSize: "clamp(5px, 2.2cqw, 7.5px)" }}
            >
              {step.label}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        className="absolute left-0 right-0 text-center"
        style={{ bottom: pctY(6), color: c.muted, fontSize: "clamp(5px, 2.1cqw, 7px)" }}
      >
        Powered by Tillz
      </div>
    </div>
  );
}
