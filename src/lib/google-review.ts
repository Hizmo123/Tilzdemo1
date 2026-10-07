// Validates and normalises what a venue pastes into the "Google reviews"
// settings card into the one thing we're ever willing to store: a Google
// review URL with a hostname we recognise. Never stores arbitrary input —
// see dashboard/settings/venue/google-review-actions.ts, the only writer of
// Restaurant.googleReviewUrl, which always goes through this first.

// Exact-match allowlist, https only. "www.google.com"/"google.com" cover the
// plain Google Maps/Search share links; the rest are Google's own
// review-specific short/long domains.
const ALLOWED_HOSTS = new Set([
  "google.com",
  "www.google.com",
  "search.google.com",
  "g.page",
  "maps.app.goo.gl",
  "goo.gl",
]);

// Google Place IDs for a physical location ("feature" type) always start
// with this literal prefix — see
// https://developers.google.com/maps/documentation/places/web-service/place-id.
// Case-sensitive, matching Google's own IDs (never lowercase them).
const PLACE_ID_PREFIX = "ChIJ";

export type GoogleReviewValidation = { ok: true; url: string } | { ok: false; error: string };

export function normalizeGoogleReviewUrl(raw: string): GoogleReviewValidation {
  const input = raw.trim();
  if (!input) return { ok: false, error: "Paste a review link or Place ID." };

  if (input.startsWith(PLACE_ID_PREFIX)) {
    // A Place ID has no spaces and no scheme — if it has either, the user
    // probably pasted something else that happens to start with "ChIJ".
    if (/\s/.test(input) || input.includes("://")) {
      return { ok: false, error: "That doesn't look like a Place ID. Paste just the ID, or a full review link." };
    }
    return { ok: true, url: `https://search.google.com/local/writereview?placeid=${input}` };
  }

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, error: "That doesn't look like a valid link." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "The link must start with https://." };
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return { ok: false, error: "That doesn't look like a Google review link. Paste a g.page, Google Maps, or Place ID link." };
  }

  return { ok: true, url: parsed.toString() };
}
