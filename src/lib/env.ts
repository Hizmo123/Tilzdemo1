// Fail fast with a clear message if required env vars are missing, rather than
// surfacing a cryptic error deep in a request.
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Add it to your .env file. See .env.example.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabasePublishableKey: () => required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  // "sandbox" | "production" — which Square environment to talk to.
  squareEnv: () => required("SQUARE_ENV"),
  squareApplicationId: () => required("SQUARE_APPLICATION_ID"),
  squareApplicationSecret: () => required("SQUARE_APPLICATION_SECRET"),
  squareRedirectUrl: () => required("SQUARE_REDIRECT_URL"),
  // Base64-encoded 32-byte key for AES-256-GCM token encryption (see
  // src/lib/square/crypto.ts). Never logged, never sent to the client.
  squareTokenEncKey: () => required("SQUARE_TOKEN_ENC_KEY"),
  // Tillz's application fee on Square-connected card payments, in basis
  // points of the goods amount (not tip/surcharge) — see
  // src/lib/square/pay.ts. Optional; defaults to 0 (no fee) rather than
  // required(), since most deployments won't set this until Tillz's own
  // monetization on connected payments is actually turned on.
  squareAppFeeBps: (): number => {
    const raw = process.env.SQUARE_APP_FEE_BPS;
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  },
  // Signs Square webhook deliveries — verified against every request to
  // /api/square/webhook before its body is trusted for anything. See
  // src/app/api/square/webhook/route.ts.
  squareWebhookSignatureKey: () => required("SQUARE_WEBHOOK_SIGNATURE_KEY"),
};
