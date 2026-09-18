// Single source of truth for the app's public base URL. QR/NFC links, staff
// invite links, staff-login links and auth email redirects all build on this,
// so they point at the deployed host — not localhost — the moment the app runs
// on Vercel.
//
// Resolution order:
//   1. NEXT_PUBLIC_APP_URL             — explicit override. Set this to your
//                                        custom domain once you have one; it
//                                        always wins.
//   2. VERCEL_PROJECT_PRODUCTION_URL   — the stable production domain on Vercel.
//                                        Best for printed QR codes: it never
//                                        changes between deployments.
//   3. VERCEL_URL                      — this specific deployment. Covers preview
//                                        deployments so their QR codes resolve
//                                        to the preview you're testing on.
//   4. http://localhost:3000           — local dev fallback.
//
// All callers run on the server, so the non-public VERCEL_* vars (available at
// runtime on Vercel) are fine to read here.
export function appBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return `https://${prod.replace(/\/+$/, "")}`;

  const deployment = process.env.VERCEL_URL?.trim();
  if (deployment) return `https://${deployment.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}

// The customer visit URL a QR/NFC tag encodes for a table.
export function visitUrl(token: string): string {
  return `${appBaseUrl()}/v/${token}`;
}

// The URL a physical Tillz stand's printed QR encodes. Always /s/<standId> —
// never the table's own /v/<token> visit URL directly, since that's exactly
// what lets a stand be moved to a different table later with no reprint (see
// lib/stands.ts#resolveStand).
export function standUrl(standId: string): string {
  return `${appBaseUrl()}/s/${standId}`;
}
