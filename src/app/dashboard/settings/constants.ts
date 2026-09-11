// Plain constants shared between the settings server actions and the client
// form. These MUST live outside actions.ts — a "use server" module may only
// export async functions, so exporting arrays from there turns them into opaque
// server references at runtime (causing "TIMEZONES.map is not a function").

export const CURRENCIES = ["AUD", "NZD", "USD", "GBP", "EUR", "AED"] as const;
export const THEMES = ["warm", "minimal", "fresh", "bold"] as const;
export const THEME_MODES = ["light", "dark"] as const;
export const FONT_THEMES_KEYS = ["classic", "elegant", "modern"] as const;
export const TIMEZONES = [
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Adelaide",
  "Australia/Perth",
  "Australia/Hobart",
  "Australia/Darwin",
  "Pacific/Auckland",
] as const;
