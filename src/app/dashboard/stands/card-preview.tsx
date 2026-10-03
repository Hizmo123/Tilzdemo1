"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/brand";

// Live HTML/CSS approximation of the printed A6 stand card (see
// src/lib/stand-card-template.ts for the actual print-ready PDF this
// mirrors). The PDF's layout is baseline-based mm coordinates; CSS boxes
// position by top-edge + line-height, not baselines, so the two coordinate
// systems don't correspond 1:1 once real text metrics are involved. Only
// the QR tile + its accent frame are geometry-driven (a square must render
// as a square) and use the trim-box percentages below — everything else
// flows in a single top-to-bottom flex column with gaps tuned by eye.
const TRIM_W = 105;
const TRIM_H = 148;

const pctX = (mm: number) => `${(mm / TRIM_W) * 100}%`;

// Headline auto-fit, ported 1:1 from stand-card-template.ts's own fitting
// logic (not imported — that file pulls in pdf-lib, which has no business
// in this client bundle). HEADLINE_MIN_RATIO is the same 14pt-of-26pt floor
// the PDF uses, expressed as a fraction so it applies whatever size the
// cqw-based clamp below resolves to for this container. UNDERLINE_TO_TEXT_RATIO
// is the same ~0.721 the PDF derives from "TILLZ" at 26pt vs its original
// 18mm underline — keeping both renderers' underline-to-text proportion
// identical is what the ratio is for, not the string it was measured from.
const HEADLINE_MIN_RATIO = 14 / 26;
const UNDERLINE_TO_TEXT_RATIO = 0.7209577522466513;

const PALETTES = {
  dark: { bg: "#0B0F0D", ink: "#FFFFFF", muted: "#9CA89F", accent: "#22C55E" },
  light: { bg: "#F7F5F0", ink: "#111412", muted: "#6B7570", accent: "#0F9D58" },
} as const;

export type CardPalette = keyof typeof PALETTES;

// QR tile/frame geometry, ported 1:1 from stand-card-template.ts's own
// constants — this part alone still corresponds directly to the PDF, since
// it's pure square geometry with no text baselines involved.
const TILE_SIZE = 52;
const FRAME_OFFSET = 3;
const FRAME_SIZE = TILE_SIZE + FRAME_OFFSET * 2;
const QR_INSET = 4;
const QR_SIZE = TILE_SIZE - QR_INSET * 2;
const COLUMN_W = TRIM_W / 3;
const ICON_SIZE = 9;

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

  const wrapperRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ fontSizePx: number; underlineWidthPx: number } | null>(null);

  // Shrink the headline (never grow it) until it fits within its padded
  // wrapper — the wrapper's own `0 ${pctX(12)}` padding IS the trim's 12mm
  // margin, so "fits the wrapper" and "fits trim width minus 12mm margins"
  // are the same condition here. Re-measures on resize (the preview panel
  // is responsive) and whenever the headline text itself changes.
  useLayoutEffect(() => {
    const wrapperEl = wrapperRef.current;
    const headlineEl = headlineRef.current;
    if (!wrapperEl || !headlineEl) return;

    const recompute = () => {
      headlineEl.style.fontSize = "";
      const baseFontSizePx = parseFloat(getComputedStyle(headlineEl).fontSize);
      const availableWidthPx = wrapperEl.clientWidth;
      const naturalWidthPx = headlineEl.scrollWidth;
      const minFontSizePx = baseFontSizePx * HEADLINE_MIN_RATIO;

      let fontSizePx = baseFontSizePx;
      let textWidthPx = naturalWidthPx;
      if (naturalWidthPx > availableWidthPx && availableWidthPx > 0) {
        fontSizePx = Math.max(minFontSizePx, baseFontSizePx * (availableWidthPx / naturalWidthPx));
        headlineEl.style.fontSize = `${fontSizePx}px`;
        textWidthPx = headlineEl.scrollWidth;
      }
      setFit({ fontSizePx, underlineWidthPx: textWidthPx * UNDERLINE_TO_TEXT_RATIO });
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(wrapperEl);
    return () => ro.disconnect();
  }, [headlineText, palette]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-[var(--radius-md)] border border-line shadow-sm select-none flex flex-col items-center"
      style={{
        aspectRatio: `${TRIM_W} / ${TRIM_H}`,
        background: c.bg,
        containerType: "inline-size",
      }}
    >
      {/* Headline + underline, flowed in DOM order so the underline sits
          right after the headline's actual rendered height rather than
          guessing where it ends. */}
      <div
        ref={wrapperRef}
        className="flex flex-col items-center text-center w-full"
        style={{ marginTop: "9%", padding: `0 ${pctX(12)}` }}
      >
        <div
          ref={headlineRef}
          className="font-display font-bold"
          style={{
            color: c.accent,
            fontSize: fit ? `${fit.fontSizePx}px` : "clamp(10px, 8.2cqw, 22px)",
            lineHeight: 1.15,
            whiteSpace: "nowrap",
          }}
        >
          {headlineText}
        </div>
        <div
          style={{
            marginTop: "3%",
            width: fit ? `${fit.underlineWidthPx}px` : pctX(18),
            height: 1.5,
            background: c.accent,
            flexShrink: 0,
          }}
        />
      </div>

      {/* QR frame + tile — the one part that stays purely geometry-driven,
          sized as % of the card's own width (see pctX's comment) so a
          "52mm square" renders as an actual square at any preview size. */}
      <div
        className="relative"
        style={{ marginTop: "7%", width: pctX(FRAME_SIZE), aspectRatio: "1 / 1", flexShrink: 0 }}
      >
        <div
          className="absolute inset-0 rounded-[8%]"
          style={{ border: `1.5px solid ${c.accent}` }}
        />
        <div
          className="absolute rounded-[8%] bg-white"
          style={{
            top: "50%",
            left: "50%",
            width: `${(TILE_SIZE / FRAME_SIZE) * 100}%`,
            aspectRatio: "1 / 1",
            transform: "translate(-50%, -50%)",
            border: `2px solid ${c.accent}`,
          }}
        >
          {/* Inset QR area, sized as a % of the tile itself. No real QR
              exists pre-payment — this always shows the placeholder. */}
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
      </div>

      {/* SCAN TO ORDER, flowed after the QR block with a real gap. */}
      <div
        className="font-bold text-center"
        style={{ marginTop: "6%", color: c.ink, fontSize: "clamp(7px, 3.4cqw, 12px)", flexShrink: 0 }}
      >
        SCAN TO ORDER
      </div>

      {/* Order / Pay / Enjoy row, flowed after "SCAN TO ORDER" with a real
          gap rather than a second independently-guessed offset. */}
      <div className="flex w-full" style={{ marginTop: "7%", flexShrink: 0 }}>
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
            <div style={{ width: pctX(ICON_SIZE), aspectRatio: "1 / 1" }}>
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

      {/* Footer — pinned to the bottom of the column via margin-top: auto,
          so it stays flush with the card's bottom edge regardless of how
          much space the content above actually takes up. */}
      <div
        className="text-center w-full"
        style={{
          marginTop: "auto",
          marginBottom: "4%",
          padding: "0 6%",
          color: c.muted,
          fontSize: "clamp(5px, 2.1cqw, 7px)",
        }}
      >
        {BRAND.poweredBy}
      </div>
    </div>
  );
}
