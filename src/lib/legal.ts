// Single source of truth for the identity facts the Terms and Privacy pages
// cite. Nothing else in the codebase should hardcode the legal entity, ABN,
// address or effective dates. Brand name and domain come from BRAND.

import { BRAND } from "@/lib/brand";

export const LEGAL = {
  // The legal person that contracts with Venues. Sole trader until a company
  // is registered; once a Pty Ltd exists, replace with e.g.
  // "Tap-to-It Pty Ltd (ACN 000 000 000)" and update the ABN to match.
  entityName: "Zayd Abd-Allah Bassam Ajaj trading as Tap-to-It",
  abn: "93 236 439 291",
  tradingName: BRAND.name,

  // Postal address for notices under the Terms and privacy requests. Must be a
  // real, monitored address. REPLACE before publishing.
  address: "55 Batt Street Sefton, NSW, Australia",

  // Monitored inboxes (set up email routing before publishing).
  supportEmail: BRAND.supportEmail,
  privacyEmail: BRAND.privacyEmail,

  // Bump these whenever the substantive text changes. ISO dates.
  termsEffective: "2026-10-07",
  privacyEffective: "2026-10-07",

  // Where the database and file storage live. Confirm against the Supabase
  // project's region setting before publishing.
  hostingRegion: "Sydney, Australia (AWS ap-southeast-2)",

  // Governing law and forum.
  governingState: "New South Wales",
} as const;

export function formatLegalDate(iso: string): string {
  return new Date(`${iso}T00:00:00+11:00`).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Sydney",
  });
}
