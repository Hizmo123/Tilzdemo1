"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. Uses the publishable key, which is safe to ship
// to the browser. Never import the secret key into client code.
// Passkeys (biometric login) are a beta feature and must be opted into here.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        experimental: { passkey: true },
      },
    },
  );
}
