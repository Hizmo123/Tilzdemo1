// Curated country list for onboarding's location step (and its Settings ->
// Venue setup mirror). Deliberately not exhaustive — "Other" falls back to
// picking any timezone from the full combined list rather than blocking
// setup. Real per-country tax rules only exist for Australia today (see the
// onboarding wizard's tax step) — every other country just gets sensible
// currency/timezone defaults until the venue supplies real rules for it.
export type CountryCode = "AU" | "NZ" | "GB" | "US" | "DE" | "AE" | "OTHER";

export const COUNTRIES: {
  code: CountryCode;
  name: string;
  currency: string;
  timezones: string[];
}[] = [
  {
    code: "AU",
    name: "Australia",
    currency: "AUD",
    timezones: [
      "Australia/Sydney",
      "Australia/Melbourne",
      "Australia/Brisbane",
      "Australia/Adelaide",
      "Australia/Perth",
      "Australia/Hobart",
      "Australia/Darwin",
    ],
  },
  { code: "NZ", name: "New Zealand", currency: "NZD", timezones: ["Pacific/Auckland"] },
  { code: "GB", name: "United Kingdom", currency: "GBP", timezones: ["Europe/London"] },
  {
    code: "US",
    name: "United States",
    currency: "USD",
    timezones: [
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
    ],
  },
  { code: "DE", name: "Germany", currency: "EUR", timezones: ["Europe/Berlin"] },
  { code: "AE", name: "United Arab Emirates", currency: "AED", timezones: ["Asia/Dubai"] },
  { code: "OTHER", name: "Other / not listed", currency: "AUD", timezones: [] },
];

export const ALL_TIMEZONES: string[] = Array.from(
  new Set(COUNTRIES.flatMap((c) => c.timezones)),
);

export function timezonesForCountry(code: string): string[] {
  const zones = COUNTRIES.find((c) => c.code === code)?.timezones;
  return zones && zones.length > 0 ? zones : ALL_TIMEZONES;
}

export function currencyForCountry(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.currency ?? "AUD";
}

// Which countries have real, venue-facing tax fields wired up (currently just
// Australia's ABN). Everyone else sees a "not set up for your country yet"
// note on the tax step instead of a field that does nothing.
export function hasTaxRules(code: string): boolean {
  return code === "AU";
}
