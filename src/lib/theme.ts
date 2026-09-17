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

export type ThemeKey = "warm" | "minimal" | "fresh" | "bold" | "ocean" | "sunset" | "slate";
export type ThemeMode = "light" | "dark";
export type FontKey = "classic" | "elegant" | "modern";
export type CornerKey = "sharp" | "soft" | "round";

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
  ocean: {
    label: "Ocean",
    blurb: "Deep blues and slate — calm, coastal.",
    defaultAccent: "#1d4ed8",
    light: {
      paper: "#eef3fa",
      surface: "#ffffff",
      ink: "#0f1f33",
      inkSoft: "#33455c",
      muted: "#647389",
      line: "#dbe4f0",
    },
    dark: {
      paper: "#0a1420",
      surface: "#122132",
      ink: "#eaf1fb",
      inkSoft: "#b8c8dd",
      muted: "#7c8ba1",
      line: "#1c2c40",
    },
  },
  sunset: {
    label: "Sunset",
    blurb: "Warm coral and gold — vivid, energetic.",
    defaultAccent: "#ea580c",
    light: {
      paper: "#fdf1e7",
      surface: "#fffaf5",
      ink: "#331d0f",
      inkSoft: "#63412a",
      muted: "#8f7259",
      line: "#f0ddc9",
    },
    dark: {
      paper: "#241408",
      surface: "#331c0d",
      ink: "#fbeee1",
      inkSoft: "#dcbc9d",
      muted: "#a68a6f",
      line: "#432711",
    },
  },
  slate: {
    label: "Slate",
    blurb: "Dark charcoal — sharp and moody, not just muted grey.",
    defaultAccent: "#7c3aed",
    light: {
      paper: "#eef0f2",
      surface: "#ffffff",
      ink: "#1a1d23",
      inkSoft: "#40454e",
      muted: "#6f7480",
      line: "#dbdfe4",
    },
    dark: {
      paper: "#101216",
      surface: "#1a1d23",
      ink: "#eef0f2",
      inkSoft: "#c3c7ce",
      muted: "#8b909a",
      line: "#2a2e35",
    },
  },
};

// A genuinely diverse accent-colour palette — spans warm/cool, saturated/muted,
// light/dark, not just the primary hues. Offered as one-tap swatches on both
// the onboarding wizard's and Settings' branding pages; a custom colour input
// sits alongside it for anything not covered here.
export const ACCENT_SWATCHES = [
  "#0f5c42", // pine
  "#0d9488", // teal
  "#0891b2", // cyan
  "#1d4ed8", // blue
  "#4338ca", // indigo
  "#7c3aed", // violet
  "#a21caf", // fuchsia
  "#be185d", // pink
  "#e11d48", // rose
  "#b91c1c", // red
  "#c2410c", // orange
  "#d97706", // amber
  "#a1552f", // terracotta
  "#65a30d", // olive
  "#15803d", // green
  "#0369a1", // sky
  "#6d28d9", // deep purple
  "#9f1239", // wine
  "#57534e", // warm grey
  "#15181b", // near-black
] as const;

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

// Card/button corner rounding. --radius-card was a fixed 14px in globals.css;
// it now lives here so it themes per-venue like everything else.
export const CORNER_STYLES: Record<CornerKey, { label: string; radius: string }> = {
  sharp: { label: "Sharp", radius: "4px" },
  soft: { label: "Soft", radius: "14px" },
  round: { label: "Round", radius: "24px" },
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
  cornerStyle?: string | null;
};

function presetOf(key?: string | null): Preset {
  return THEME_PRESETS[(key as ThemeKey) ?? "warm"] ?? THEME_PRESETS.warm;
}
function fontOf(key?: string | null) {
  return FONT_THEMES[(key as FontKey) ?? "classic"] ?? FONT_THEMES.classic;
}
function cornerOf(key?: string | null) {
  return CORNER_STYLES[(key as CornerKey) ?? "soft"] ?? CORNER_STYLES.soft;
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
  const corner = cornerOf(a.cornerStyle);

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
    ["--radius-card" as string]: corner.radius,
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

// ---- legibility guardrail (A5) ----------------------------------------------
// WCAG 2 relative luminance / contrast ratio — the real formula, not the
// simplified perceived-luminance one `onAccent` uses above (that one's fine
// for a quick "pick black or white text" choice; this one is a real pass/fail
// threshold, used to block saving a combination that would be hard to read).
function srgbChannel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 1; // fail safe toward "assume light, demand contrast"
  const [r, g, b] = rgb.map(srgbChannel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

// WCAG AA for normal-size text is 4.5:1. Menu item names/prices are small
// text on a phone screen, not a place to be generous with this threshold.
export const MIN_READABLE_CONTRAST = 4.5;

export function isReadableContrast(fg: string, bg: string): boolean {
  return contrastRatio(fg, bg) >= MIN_READABLE_CONTRAST;
}

// Checks the combinations that actually matter for a venue's appearance
// choice: body text on the page background, and the "on accent" text
// (already computed to be black or white) against the accent itself — e.g. a
// pale accent colour with white on-accent text would fail this even though
// `onAccent` "successfully" picked a colour, because pale + white is still
// unreadable. Returns the first failure found, or null if all pass.
export function findContrastIssue(a: Appearance): string | null {
  const preset = presetOf(a.theme);
  const mode: ThemeMode = a.themeMode === "dark" ? "dark" : "light";
  const pal = preset[mode];
  const accent = resolveAccent(a);

  if (!isReadableContrast(pal.ink, pal.paper)) {
    return "This theme's text isn't readable against its own background — try a different theme.";
  }
  const onAccentColor = onAccent(accent);
  if (!isReadableContrast(onAccentColor, accent)) {
    return "That accent colour is too pale for button text to read clearly on it — try a darker shade.";
  }
  return null;
}
