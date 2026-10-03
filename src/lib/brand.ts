// Single source of truth for brand strings. Every user-visible surface
// (nav, metadata, emails, legal pages, stand cards) should import from here
// rather than hardcoding "Tap-to-It" / "TAP-TO-IT" a second time.
export const BRAND = {
  name: "Tap-to-It",
  wordmark: "TAP-TO-IT",
  slug: "taptoit",
  domain: "taptoit.com.au",
  supportEmail: "support@taptoit.com.au",
  privacyEmail: "privacy@taptoit.com.au",
  poweredBy: "Powered by Tap-to-It",
} as const;
