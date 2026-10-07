import type { PlanTier } from "@prisma/client";
import { env } from "@/lib/env";

// Plan tier -> Stripe Price id, read from env so the mapping can be filled in
// per-environment (test/live Stripe have different price ids) without a code
// change. Only the three self-assignable subscription tiers have one — CONNECT
// has no subscription, and BASIC is grandfathered (never newly subscribed to).
export function stripePriceForTier(tier: PlanTier): string | null {
  switch (tier) {
    case "LITE":
      return env.stripePriceLite() ?? null;
    case "GROWTH":
      return env.stripePriceGrowth() ?? null;
    case "PRO":
      return env.stripePricePro() ?? null;
    default:
      return null;
  }
}

// PRO's paid-per-venue addon past the 3 included (see
// lib/entitlements.ts#canCreateVenue) — kept separate from stripePriceForTier
// since it's not a plan tier, just a line item on top of PRO's subscription.
export function stripePriceForExtraVenue(): string | null {
  return env.stripePriceExtraVenue() ?? null;
}

// The reverse of stripePriceForTier — a webhook only ever has the Stripe
// Price id a subscription item actually carries, never the tier name
// directly, so syncing Organization.plan from a webhook has to go through
// this. Returns null for a price that matches none of the 3 tiers (e.g. the
// extra-venue price, or a price created for something else entirely) rather
// than guessing — the caller decides what "unrecognised price" means.
export function tierForStripePrice(priceId: string | null | undefined): PlanTier | null {
  if (!priceId) return null;
  if (priceId === env.stripePriceLite()) return "LITE";
  if (priceId === env.stripePriceGrowth()) return "GROWTH";
  if (priceId === env.stripePricePro()) return "PRO";
  return null;
}
