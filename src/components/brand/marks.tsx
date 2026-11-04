"use client";

import { useId, type CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";

// All of Tap-to-It's icon marks, as inline SVG React components, in one
// file — so the tile/glyph geometry can never drift between a nav icon, the
// favicon, and an arrival/success animation using the "same" mark. Every
// mark's tile fill is `currentColor` (the parent sets colour — the brand
// green token, `text-pine`, everywhere it's used in this app) and every
// glyph is white, so a mark always reads correctly against its own tile
// regardless of what colour the caller picks.

type MarkProps = {
  size?: number;
  className?: string;
  title?: string;
  // Escape hatch for pages where `currentColor` would pick up the wrong
  // thing — e.g. /v/[token]'s customer pages remap --color-pine to the
  // VENUE's own accent (lib/theme.ts), so a mark that must stay Tap-to-It's
  // own brand colour regardless of venue theme needs an explicit style
  // override rather than a `text-pine` className there.
  style?: CSSProperties;
};

function a11yProps(title?: string) {
  return title ? { role: "img" as const, "aria-label": title } : { "aria-hidden": true as const };
}

// The logo: the gradient "T" mark with a swoosh on its left edge (same
// geometry as public/brand/mark.svg). Unlike the animation-state marks below
// it has no tile and ignores `currentColor` — the gradient is the brand.
export function BrandMark({ size = 64, className = "", title, style }: MarkProps) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} style={style} {...a11yProps(title)}>
      <defs>
        <linearGradient id={id} x1="8" y1="8" x2="52" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2BE58A" />
          <stop offset="1" stopColor="#0FA95B" />
        </linearGradient>
      </defs>
      <path d="M3 25C7 15 19 11 31 11H60C58 21 50 25 40 25Z" fill={`url(#${id})`} />
      <path d="M26 28H41V42C41 50 35 56 25 60C27 52 26 42 26 28Z" fill={`url(#${id})`} />
    </svg>
  );
}

// Deprecated: use BrandMark. Kept as an alias (not a re-export of the same
// identity — a distinct const — so existing `<TillzMark />` JSX usages and
// `import { TillzMark }` keep working unchanged) purely so nothing breaks
// while callers migrate; new code should never reach for this name.
/** @deprecated Use BrandMark instead. */
export const TillzMark = BrandMark;

// State A — NFC tap: three concentric rings pulsing outward from a filled
// dot, once, on arrival. The STATIC rendering (no `animate` prop) used
// wherever the mark appears without the arrival animation — see
// src/components/brand/arrival-animation.tsx for the animated version.
export function TapRippleMark({ size = 64, className = "", title, style }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} style={style} {...a11yProps(title)}>
      <rect width="64" height="64" rx="16" fill="currentColor" />
      <circle cx="32" cy="32" r="6" fill="#fff" />
      <circle cx="32" cy="32" r="13" fill="none" stroke="#fff" strokeWidth="3.5" opacity="0.8" />
      <circle cx="32" cy="32" r="21" fill="none" stroke="#fff" strokeWidth="3.5" opacity="0.4" />
    </svg>
  );
}

// State B — QR scan: four corner brackets (a viewfinder) around a filled
// dot. Static rendering; see arrival-animation.tsx for the draw-in version.
export function ScanFrameMark({ size = 64, className = "", title, style }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} style={style} {...a11yProps(title)}>
      <rect width="64" height="64" rx="16" fill="currentColor" />
      <path
        d="M13 25V19a6 6 0 0 1 6-6h6M39 13h6a6 6 0 0 1 6 6v6M51 39v6a6 6 0 0 1-6 6h-6M25 51h-6a6 6 0 0 1-6-6v-6"
        fill="none"
        stroke="#fff"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="32" r="6.5" fill="#fff" />
    </svg>
  );
}

// State D — paid/submitted: a filled disc with a drawn-in checkmark, inside
// a faint outer ring. Static rendering; see DoneAnimation below for the
// draw-in version used on the order-submitted/payment-success screens.
export function DoneMark({ size = 64, className = "", title, style }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} style={style} {...a11yProps(title)}>
      <circle cx="32" cy="32" r="31" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      <circle cx="32" cy="32" r="25" fill="currentColor" />
      <path
        d="M21 33l8 8 14-17"
        fill="none"
        stroke="#fff"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// The wordmark: lowercase "taptoit" in Outfit with a green dot — logo lockup
// only, never a substitute for BRAND.name in copy/emails/legal. Real text, not
// a raster; text colour is inherited, the dot is the brand green.
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-semibold tracking-tight lowercase ${className}`}
      style={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif" }}
    >
      taptoit
      <span style={{ color: "var(--color-brand-green, #2BE58A)" }}>.</span>
    </span>
  );
}

// ---- Animated states --------------------------------------------------
//
// One-shot animations for TapRippleMark/ScanFrameMark (arrival) and
// DoneMark (paid/submitted). Each respects prefers-reduced-motion: with it
// on, nothing animates — the static mark just shows, instantly. Each plays
// exactly once per mount (no loop), which is what "arrival"/"paid" calls
// for; callers control WHEN it mounts (see arrival-animation.tsx's
// sessionStorage guard and the success screens' one-time render).

export function TapRippleAnimation({ size = 64, className = "", style }: { size?: number; className?: string; style?: CSSProperties }) {
  const reduced = useReducedMotion();
  if (reduced) return <TapRippleMark size={size} className={className} style={style} />;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} style={style} aria-hidden>
      <rect width="64" height="64" rx="16" fill="currentColor" />
      <circle cx="32" cy="32" r="6" fill="#fff" />
      {[13, 21].map((r, i) => (
        <motion.circle
          key={r}
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="#fff"
          strokeWidth="3.5"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, i === 0 ? 0.8 : 0.4, 0], scale: [0.5, 1, 1.15] }}
          transition={{ duration: 0.7, delay: i * 0.15, ease: "easeOut" }}
          style={{ transformOrigin: "32px 32px" }}
        />
      ))}
    </svg>
  );
}

export function ScanFrameAnimation({ size = 64, className = "", style }: { size?: number; className?: string; style?: CSSProperties }) {
  const reduced = useReducedMotion();
  if (reduced) return <ScanFrameMark size={size} className={className} style={style} />;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} style={style} aria-hidden>
      <rect width="64" height="64" rx="16" fill="currentColor" />
      <motion.path
        d="M13 25V19a6 6 0 0 1 6-6h6M39 13h6a6 6 0 0 1 6 6v6M51 39v6a6 6 0 0 1-6 6h-6M25 51h-6a6 6 0 0 1-6-6v-6"
        fill="none"
        stroke="#fff"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      <motion.circle
        cx="32"
        cy="32"
        r="6.5"
        fill="#fff"
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.5, ease: "easeOut" }}
      />
    </svg>
  );
}

export function DoneAnimation({ size = 64, className = "", style }: { size?: number; className?: string; style?: CSSProperties }) {
  const reduced = useReducedMotion();
  if (reduced) return <DoneMark size={size} className={className} style={style} />;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} style={style} aria-hidden>
      <circle cx="32" cy="32" r="31" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      <motion.circle
        cx="32"
        cy="32"
        r="25"
        fill="currentColor"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{ transformOrigin: "32px 32px" }}
      />
      <motion.path
        d="M21 33l8 8 14-17"
        fill="none"
        stroke="#fff"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.3, ease: "easeOut" }}
      />
    </svg>
  );
}
