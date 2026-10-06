"use client";

import type { CSSProperties } from "react";
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

// The logo: a bold "T" built from two rectangles, with two signal arcs
// sweeping off its crossbar — "T + signal", the tap-to-order read. The
// static mark (no animation) — see TapRippleMark/ScanFrameMark for the
// arrival-animation states and DoneMark for the paid/submitted state.
export function BrandMark({ size = 64, className = "", title, style }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} style={style} {...a11yProps(title)}>
      <rect width="64" height="64" rx="16" fill="currentColor" />
      <rect x="14" y="15" width="28" height="8" rx="3" fill="#fff" />
      <rect x="24" y="15" width="8" height="34" rx="3" fill="#fff" />
      <path d="M39 34c3.5 3.5 3.5 9.5 0 13" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      <path
        d="M45 29c6.5 6.5 6.5 16.5 0 23"
        fill="none"
        stroke="#fff"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.6"
      />
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

// The wordmark lockup: lowercase "tap-to-it", "it" in the brand green —
// NEVER a substitute for BRAND.name in copy/emails/legal (that stays the
// proper-case "Tap-to-It"); this is the logo lockup only. Uses the app's
// existing display font (font-display), no new font dependency.
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-semibold tracking-tight lowercase ${className}`}>
      tap-to-
      <span className="text-pine">it</span>
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
