import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// Tillz customer-page theming.
//
// Every customer surface reads its colours and fonts from CSS custom properties
// (--color-paper, --color-ink, --color-pine, --font-display, ...). Tailwind v4
// utilities like `bg-paper` compile to `var(--color-paper)`, so overriding those
// variables on a wrapper element re-themes everything beneath it — no per-element
// styling needed. `themeVars()` returns the full set of overrides for a venue's
// saved appearance, and the customer page spreads it onto its root <main>.
//
// A venue's look = a PRESET palette (character + light/dark base) + an ACCENT
// colour (the one brand colour) + a FONT pairing + an optional background image.
// ---------------------------------------------------------------------------

export type ThemeKey = "warm" | "minimal" | "fresh" | "bold";
export type ThemeMode = "light" | "dark";
export type FontKey = "classic" | "elegant" | "modern";

type Palette = {
  paper: string;
  surface: string;
  ink: string;
  inkSoft: string;
  muted: string;
  line: string;
};

type Preset = {
  label: string;
  blurb: string;
  defaultAccent: string;
  light: Palette;
  dark: Palette;
};

export const THEME_PRESETS: Record<ThemeKey, Preset> = {
  warm: {
    label: "Warm café",
    blurb: "Cream and earth — cosy, inviting.",
    defaultAccent: "#a1552f",
    light: {
      paper: "#f4ede2",
      surface: "#fffdf9",
      ink: "#2a2420",
      inkSoft: "#5a5147",
      muted: "#8a7d6d",
      line: "#e7ddcd",
    },
    dark: {
      paper: "#201b16",
      surface: "#2b251e",
      ink: "#f3ece1",
      inkSoft: "#cdbfae",
      muted: "#9c8f7d",
      line: "#3a322a",
    },
  },
  minimal: {
    label: "Minimal",
    blurb: "Clean neutral greys — modern, uncluttered.",
    defaultAccent: "#0f5c42",
    light: {
      paper: "#f7f7f8",
      surface: "#ffffff",
      ink: "#16181d",
      inkSoft: "#3d424b",
      muted: "#71767f",
      line: "#e6e7ea",
    },
    dark: {
      paper: "#0f1114",
      surface: "#191c21",
      ink: "#f2f4f7",
      inkSoft: "#c3c8d0",
      muted: "#878d97",
      line: "#262a30",
    },
  },
  fresh: {
    label: "Fresh",
    blurb: "Cool mint and teal — light and airy.",
    defaultAccent: "#0d9488",
    light: {
      paper: "#eef5f3",
      surface: "#ffffff",
      ink: "#10201c",
      inkSoft: "#374a45",
      muted: "#6a807a",
      line: "#d8e6e1",
    },
    dark: {
      paper: "#0d1a17",
      surface: "#14241f",
      ink: "#e9f5f1",
      inkSoft: "#b4ccc5",
      muted: "#7d968f",
      line: "#22352f",
    },
  },
  bold: {
    label: "Bold",
    blurb: "High contrast — the accent does the talking.",
    defaultAccent: "#e11d48",
    light: {
      paper: "#ffffff",
      surface: "#ffffff",
      ink: "#0a0a0b",
      inkSoft: "#2b2b2e",
      muted: "#6b6b70",
      line: "#e4e4e7",
    },
    dark: {
      paper: "#08080a",
      surface: "#141417",
      ink: "#ffffff",
      inkSoft: "#cfcfd4",
      muted: "#8a8a92",
      line: "#26262c",
    },
  },
};

export const FONT_THEMES: Record<
  FontKey,
  { label: string; display: string; sans: string }
> = {
  // Values reference the next/font CSS variables declared in the root layout.
  classic: {
    label: "Classic",
    display: "var(--font-bricolage), ui-sans-serif, system-ui, sans-serif",
    sans: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  },
  elegant: {
    label: "Elegant",
    display: "var(--font-fraunces), Georgia, ui-serif, serif",
    sans: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  },
  modern: {
    label: "Modern",
    display: "var(--font-space), ui-sans-serif, system-ui, sans-serif",
    sans: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  },
};

// ---- colour helpers --------------------------------------------------------

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function toHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("");
}

// Mix a colour toward black (amount 0..1) — used to derive the "deep" accent for
// hovers/pressed states.
function darken(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return toHex(rgb[0] * (1 - amount), rgb[1] * (1 - amount), rgb[2] * (1 - amount));
}

// A soft translucent tint of the accent, for chips/soft backgrounds. Uses an
// rgba so it reads correctly on both light and dark surfaces.
function softTint(hex: string, alpha = 0.14): string {
  const rgb = parseHex(hex);
  if (!rgb) return `rgba(15,92,66,${alpha})`;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

// Pick black or white text to sit on a given accent, by perceived luminance.
export function onAccent(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return "#ffffff";
  const [r, g, b] = rgb;
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.62 ? "#15181b" : "#ffffff";
}

// ---- resolver --------------------------------------------------------------

export type Appearance = {
  theme?: string | null;
  themeMode?: string | null;
  fontTheme?: string | null;
  brandColor?: string | null;
};

function presetOf(key?: string | null): Preset {
  return THEME_PRESETS[(key as ThemeKey) ?? "warm"] ?? THEME_PRESETS.warm;
}
function fontOf(key?: string | null) {
  return FONT_THEMES[(key as FontKey) ?? "classic"] ?? FONT_THEMES.classic;
}

// The full set of CSS variable overrides for a venue's appearance. Spread onto
// the customer page's root element via `style={...}`.
export function themeVars(a: Appearance): CSSProperties {
  const preset = presetOf(a.theme);
  const mode: ThemeMode = a.themeMode === "dark" ? "dark" : "light";
  const pal = preset[mode];
  const accent =
    a.brandColor && parseHex(a.brandColor) ? a.brandColor : preset.defaultAccent;
  const font = fontOf(a.fontTheme);

  return {
    ["--color-paper" as string]: pal.paper,
    ["--color-surface" as string]: pal.surface,
    ["--color-ink" as string]: pal.ink,
    ["--color-ink-soft" as string]: pal.inkSoft,
    ["--color-muted" as string]: pal.muted,
    ["--color-line" as string]: pal.line,
    ["--color-pine" as string]: accent,
    ["--color-pine-deep" as string]: darken(accent, 0.16),
    ["--color-pine-soft" as string]: softTint(accent, mode === "dark" ? 0.22 : 0.14),
    ["--on-accent" as string]: onAccent(accent),
    ["--font-display" as string]: font.display,
    ["--font-sans" as string]: font.sans,
  } as CSSProperties;
}

// Resolve just the effective accent (for previews / non-CSS-var contexts).
export function resolveAccent(a: Appearance): string {
  const preset = presetOf(a.theme);
  return a.brandColor && parseHex(a.brandColor)
    ? a.brandColor
    : preset.defaultAccent;
}

export function isValidHex(hex: string): boolean {
  return parseHex(hex) !== null;
}
