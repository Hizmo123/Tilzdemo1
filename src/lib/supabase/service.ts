import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Thrown instead of a generic Error so callers can surface a specific,
// actionable message rather than a swallowed "Upload failed" (image storage
// silently doing nothing was a live bug — see uploadLogo/uploadCover/etc.).
export class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      "Image storage isn't configured — add SUPABASE_SECRET_KEY to your environment to enable uploads.",
    );
  }
}

// A server-only Supabase client using the secret key, for privileged operations
// like uploading to Storage. NEVER import this into client components — the
// secret key must never reach the browser.
//
// The explicit `apikey` header below fixes the general "Storage rejects a
// current-format sb_secret_... key when it only sees Authorization: Bearer"
// case. On THIS project, though, that alone isn't enough — verified directly
// against Supabase's live Storage API: even with both apikey and Authorization
// headers set correctly, the gateway still rejects the sb_secret_ key outright
// ("Invalid Compact JWS" / AccessDenied). That's a known gap where Storage
// still requires the legacy JWT-format service_role key, not the new format,
// on some projects. So this prefers SUPABASE_SERVICE_ROLE_KEY (the legacy JWT
// key, from Supabase dashboard -> Project Settings -> API -> Legacy API keys)
// when it's set, and only falls back to the new-format secret key otherwise —
// which is what's currently failing every upload.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const legacyKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = legacyKey || process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new StorageNotConfiguredError();
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { apikey: secret } },
  });
}

// Turns a raw Storage error into something an owner can actually act on.
// "Invalid Compact JWS" / AccessDenied means the configured key isn't being
// accepted by Storage (see createServiceClient's comment) — that's a
// deployment config problem, not something retrying or picking a different
// file fixes, so say so plainly instead of surfacing the raw gateway message.
export function describeStorageError(rawMessage: string): string {
  if (/compact jws|accessdenied/i.test(rawMessage)) {
    return "Image storage isn't configured correctly — this needs fixing on our end, not yours. Please contact support.";
  }
  return `Upload failed: ${rawMessage}`;
}

export const MENU_IMAGE_BUCKET = "menu-images";

// Creates the bucket if it's missing, or flips it public if it exists but
// isn't — a private bucket serves 404s for the public URLs this app hands out
// everywhere (logo/cover/background/menu images), which was a live bug.
export async function ensurePublicBucket(
  supabase: SupabaseClient,
  bucket: string,
): Promise<void> {
  const { data: existing } = await supabase.storage.getBucket(bucket);
  if (!existing) {
    await supabase.storage.createBucket(bucket, { public: true });
  } else if (!existing.public) {
    await supabase.storage.updateBucket(bucket, { public: true });
  }
}
