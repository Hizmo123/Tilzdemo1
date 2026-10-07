import { env } from "@/lib/env";
import type { BillingProvider } from "./provider";
import { StubBillingProvider } from "./stub";
import { StripeBillingProvider } from "./stripe-provider";

// Single place that decides which provider is active — same factory pattern
// as lib/payments/index.ts. Real Stripe the moment STRIPE_SECRET_KEY is set,
// the stub otherwise; every call site already treats a configured:false
// result as "fall back to the mock path", so this switch alone is enough to
// turn real billing on, with no other call site change.
let cached: BillingProvider | null = null;
let cachedForKey: string | undefined;

export function getBillingProvider(): BillingProvider {
  const key = env.stripeSecretKey();
  // Re-selects if the key changes (e.g. between test runs that stub env
  // vars) rather than permanently caching whichever provider was first
  // resolved in this process.
  if (!cached || cachedForKey !== key) {
    cached = key ? new StripeBillingProvider() : new StubBillingProvider();
    cachedForKey = key;
  }
  return cached;
}

export type { BillingProvider } from "./provider";
export { StripeSignatureError } from "./provider";
export { paidPlansOpen, PAID_PLANS_CLOSED_MESSAGE, SELF_ASSIGNABLE_GATED_TIERS } from "./gate";
export { stripePriceForTier, stripePriceForExtraVenue, tierForStripePrice } from "./prices";
