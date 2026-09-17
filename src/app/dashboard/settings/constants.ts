// Plain constants shared between the settings server actions and the client
// form. These MUST live outside actions.ts — a "use server" module may only
// export async functions, so exporting arrays from there turns them into opaque
// server references at runtime (causing "TIMEZONES.map is not a function").

export const CURRENCIES = ["AUD", "NZD", "USD", "GBP", "EUR", "AED"] as const;
// Kept in sync with lib/theme.ts's THEME_PRESETS keys by hand (a "use server"
// module may only export async functions, so the zod schemas that need this
// as a `const` tuple live here rather than importing Object.keys() from
// theme.ts at runtime).
export const THEMES = ["warm", "minimal", "fresh", "bold", "ocean", "sunset", "slate"] as const;
export const THEME_MODES = ["light", "dark"] as const;
export const FONT_THEMES_KEYS = ["classic", "elegant", "modern"] as const;
// Every timezone offered across every country in lib/countries.ts, flattened.
// Kept as a literal array (not computed from countries.ts) so it stays a
// `const` tuple zod can build z.enum() from.
export const TIMEZONES = [
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Adelaide",
  "Australia/Perth",
  "Australia/Hobart",
  "Australia/Darwin",
  "Pacific/Auckland",
  "Europe/London",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/Berlin",
  "Asia/Dubai",
] as const;
