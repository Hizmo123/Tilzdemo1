import { createClient } from "@supabase/supabase-js";

// A server-only Supabase client using the secret key, for privileged operations
// like uploading to Storage. NEVER import this into client components — the
// secret key must never reach the browser.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error("Supabase URL and secret key are required for storage.");
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const MENU_IMAGE_BUCKET = "menu-images";
