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

// Unset in every environment today (Stripe isn't wired up yet) — callers get
// undefined back and decide what "not configured" means for them, rather
// than this throwing like required() does.
function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

// "true"/"1" = on; anything else (including unset) = off. Used for flags that
// must default to off in every existing environment until explicitly turned
// on (BILLING_ENABLED), unlike required()'s vars, which must already be set
// everywhere this app runs.
function flag(name: string): boolean {
  const value = process.env[name];
  return value === "true" || value === "1";
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
  // Signs Square webhook deliveries — verified against every request to
  // /api/square/webhook before its body is trusted for anything. See
  // src/app/api/square/webhook/route.ts.
  squareWebhookSignatureKey: () => required("SQUARE_WEBHOOK_SIGNATURE_KEY"),

  // Master switch for real paid-plan self-service (see src/lib/billing/gate.ts).
  // Default OFF: LITE/GROWTH/PRO self-assignment stays blocked (platform
  // admins excepted) until this is flipped on, which should only happen once
  // Stripe is actually wired up below.
  billingEnabled: () => flag("BILLING_ENABLED"),
  // All unset today — nothing in src/lib/billing/ calls Stripe yet. Reading
  // stripeSecretKey() is how the stub provider decides it isn't configured.
  stripeSecretKey: () => optional("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: () => optional("STRIPE_WEBHOOK_SECRET"),
  stripePriceLite: () => optional("STRIPE_PRICE_LITE"),
  stripePriceGrowth: () => optional("STRIPE_PRICE_GROWTH"),
  stripePricePro: () => optional("STRIPE_PRICE_PRO"),
  stripePriceExtraVenue: () => optional("STRIPE_PRICE_EXTRA_VENUE"),
};
