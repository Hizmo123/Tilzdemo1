import type { CSSProperties } from "react";

// Shared presentation helpers for the customer menu (A5 deep customisation).
// Both the read-only menu (menu-display.tsx) and the interactive ordering
// menu (menu-orderer.tsx) resolve their card look through this one module, so
// a layout/card-style change renders identically whether ordering is on or
// off for a venue.

export type MenuLayout = "list" | "grid" | "magazine" | "minimal";
export type ImagePosition = "left" | "top" | "none";
export type ImageAspect = "square" | "4:3" | "16:9";
export type BorderStyle = "none" | "thin" | "bold";
export type ShadowStyle = "none" | "soft" | "lifted";
export type DividerStyle = "none" | "line" | "space";
export type TypeScale = "compact" | "comfortable" | "large";
export type SectionHeaderStyle = "plain" | "underline" | "pill" | "bold-caps";
export type ButtonShape = "pill" | "rounded" | "square";
export type ButtonFill = "solid" | "outline" | "soft";
export type BgTreatment = "solid" | "pattern" | "photo";

export const MENU_LAYOUTS: { value: MenuLayout; label: string; desc: string }[] = [
  { value: "list", label: "List", desc: "Compact rows — fits more on screen." },
  { value: "grid", label: "Grid", desc: "Bigger photo cards — needs item images." },
  { value: "magazine", label: "Magazine", desc: "Large section headers, editorial feel." },
  { value: "minimal", label: "Minimal", desc: "Text only, fastest to scan." },
];

export type CardStyle = {
  imagePosition: ImagePosition;
  imageAspect: ImageAspect;
  border: BorderStyle;
  shadow: ShadowStyle;
  divider: DividerStyle;
};

// Each layout's own sensible starting point — a venue can still override any
// individual axis from there (resolveCardStyle below), this is just what a
// layout looks like before anyone touches the card-style controls.
const LAYOUT_DEFAULTS: Record<MenuLayout, CardStyle> = {
  list: { imagePosition: "left", imageAspect: "square", border: "thin", shadow: "none", divider: "none" },
  grid: { imagePosition: "top", imageAspect: "square", border: "thin", shadow: "none", divider: "none" },
  magazine: { imagePosition: "top", imageAspect: "16:9", border: "none", shadow: "soft", divider: "space" },
  minimal: { imagePosition: "none", imageAspect: "square", border: "none", shadow: "none", divider: "line" },
};

export function defaultCardStyle(layout: string): CardStyle {
  return LAYOUT_DEFAULTS[layout as MenuLayout] ?? LAYOUT_DEFAULTS.list;
}

// `override` is the raw Restaurant.cardStyle JSON — untyped at the DB
// boundary, so this validates each axis independently rather than trusting
// the whole shape (a partial/stale/malformed blob degrades one axis at a
// time instead of falling back to defaults entirely).
export function resolveCardStyle(layout: string, override: unknown): CardStyle {
  const base = defaultCardStyle(layout);
  if (!override || typeof override !== "object") return base;
  const o = override as Record<string, unknown>;
  const pick = <T extends string>(key: string, allowed: readonly T[], fallback: T): T =>
    allowed.includes(o[key] as T) ? (o[key] as T) : fallback;
  return {
    imagePosition: pick("imagePosition", ["left", "top", "none"] as const, base.imagePosition),
    imageAspect: pick("imageAspect", ["square", "4:3", "16:9"] as const, base.imageAspect),
    border: pick("border", ["none", "thin", "bold"] as const, base.border),
    shadow: pick("shadow", ["none", "soft", "lifted"] as const, base.shadow),
    divider: pick("divider", ["none", "line", "space"] as const, base.divider),
  };
}

export function aspectClass(aspect: ImageAspect): string {
  return aspect === "4:3" ? "aspect-[4/3]" : aspect === "16:9" ? "aspect-video" : "aspect-square";
}

export function cardBorderClass(border: BorderStyle): string {
  return border === "bold" ? "border-2 border-line" : border === "thin" ? "border border-line" : "border-0";
}

export function cardShadowClass(shadow: ShadowStyle): string {
  return shadow === "lifted" ? "shadow-md" : shadow === "soft" ? "shadow-sm" : "";
}

// Applied between items in a LIST-shaped layout (grid-shaped ones use gap
// instead, since "divider" reads as a line/space between rows, not cards).
export function dividerClass(divider: DividerStyle): string {
  return divider === "line" ? "border-b border-line pb-3" : divider === "space" ? "pb-1" : "";
}

// Font-ROLE convention for the customer menu screen (every layout — list,
// grid, magazine, minimal — and both the read-only MenuDisplay and the
// interactive MenuOrderer/its item sheet): headline-weight text — the page
// title ("Menu"), category section headers ("Coffee"), item names ("Flat
// White") and prices — all render in the venue's own --font-display face
// (Bricolage/Fraunces/Space Grotesk depending on the venue's font choice —
// see lib/theme.ts's FONT_THEMES). Body copy (item descriptions) and UI
// chrome (category filter tabs, badges, modifier group labels) stay in
// --font-sans, since they're navigation/prose, not editorial headline copy.
//
// This constant exists so every headline-role element pulls from the SAME
// class rather than each one hardcoding "font-display" independently — a
// spot that's missed (as item names were, before this) silently falls back
// to the ambient body font and reads as a mismatched typeface next to
// everything else on the same screen, even though the venue only ever
// chose ONE display face. Use MENU_HEADLINE_FONT anywhere a new
// headline-role element is added to the menu screen.
export const MENU_HEADLINE_FONT = "font-display";

export function sectionHeaderClass(style: string): string {
  switch (style as SectionHeaderStyle) {
    case "underline":
      return "border-b-2 pb-1.5 inline-block" + " border-[var(--color-pine)]";
    case "pill":
      return "bg-[var(--color-pine-soft)] text-[var(--color-pine-deep)] rounded-full px-3 py-1 inline-flex items-center gap-1.5";
    case "bold-caps":
      return "uppercase tracking-wide";
    default:
      return "";
  }
}

export function menuButtonClass(shape: string, fill: string): string {
  const shapeClass =
    (shape as ButtonShape) === "pill" ? "rounded-full" : (shape as ButtonShape) === "square" ? "rounded-md" : "rounded-xl";
  const fillClass =
    (fill as ButtonFill) === "outline"
      ? "border-2 border-[var(--color-pine)] text-[var(--color-pine)] bg-transparent hover:bg-[var(--color-pine-soft)]"
      : (fill as ButtonFill) === "soft"
        ? "bg-[var(--color-pine-soft)] text-[var(--color-pine-deep)] hover:opacity-80"
        : "bg-[var(--color-pine)] text-[color:var(--on-accent,#fff)] hover:bg-[var(--color-pine-deep)]";
  return `${shapeClass} ${fillClass}`;
}

// Font sizes for the menu's own text (item name/description/price, category
// header) — layered on top of fontTheme, which only picks the typeface.
export const TYPE_SCALE: Record<TypeScale, { itemName: string; itemDesc: string; itemPrice: string; categoryHeader: string }> = {
  compact: { itemName: "13.5px", itemDesc: "12px", itemPrice: "13px", categoryHeader: "17px" },
  comfortable: { itemName: "15px", itemDesc: "13px", itemPrice: "14px", categoryHeader: "19px" },
  large: { itemName: "17px", itemDesc: "14.5px", itemPrice: "16px", categoryHeader: "23px" },
};

export function resolveTypeScale(scale: string) {
  return TYPE_SCALE[scale as TypeScale] ?? TYPE_SCALE.comfortable;
}

// Built-in background patterns — small repeating SVGs tinted to the venue's
// own ink colour at low opacity, so they always match the theme without a
// separate colour choice or an upload.
export const BG_PATTERNS: { key: string; label: string }[] = [
  { key: "dots", label: "Dots" },
  { key: "grid", label: "Grid" },
  { key: "diagonal", label: "Diagonal lines" },
];

function patternSvg(key: string, ink: string): string {
  const c = encodeURIComponent(ink);
  if (key === "grid") {
    return `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><path d='M32 0H0V32' fill='none' stroke='${c}' stroke-width='1'/></svg>`;
  }
  if (key === "diagonal") {
    return `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><path d='M-2 2 6 -6 M0 24 24 0 M18 26 26 18' stroke='${c}' stroke-width='1'/></svg>`;
  }
  // dots (default)
  return `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><circle cx='2' cy='2' r='1.4' fill='${c}'/></svg>`;
}

// Style for the page-background element when bgTreatment === "pattern".
export function patternBackgroundStyle(key: string | null, inkHex: string): CSSProperties {
  const svg = patternSvg(key || "dots", inkHex);
  return {
    backgroundImage: `url("data:image/svg+xml,${svg}")`,
    backgroundRepeat: "repeat",
    opacity: 0.06,
  };
}
