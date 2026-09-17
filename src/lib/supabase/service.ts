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
// The explicit `apikey` header below is required, not decorative: Supabase's
// Storage gateway rejects the current-format `sb_secret_...` key when it only
// sees an `Authorization: Bearer` header (which createClient() sets on its
// own) — Storage specifically also needs `apikey` carrying the same key, or
// it tries to parse something in the wrong slot as a JWT and fails with
// "Invalid Compact JWS". Legacy JWT-format service_role keys don't hit this;
// only the newer sb_secret_/sb_publishable_ keys do. This was the exact cause
// of logo/cover/background uploads failing with that error.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new StorageNotConfiguredError();
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { apikey: secret } },
  });
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
