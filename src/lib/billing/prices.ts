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
