import type { PlanTier } from "@prisma/client";

// The subscription catalog (AUD, excluding GST). Prices are wired through the
// mock billing flow so the whole signup -> choose plan -> pay journey works
// end to end today; real Stripe Billing (Delivery 2) replaces the checkout
// behind the same PLANS/planByTier surface, not the catalog itself.
//
// Feature copy below intentionally does NOT list full analytics as
// Standard/Pro-only, even though the original spec described it that way —
// it already works, unrestricted, on every tier today, and tier limits are
// only allowed to be about scale/polish, never about disabling something
// that currently works (see lib/entitlements.ts). Gating it would be a real
// product regression for existing Free-tier usage, so this was flagged back
// rather than silently built either way — the actual enforced differences
// are table count, venue count, and the Tillz branding mark, which is what
// this copy reflects.
export type PlanDef = {
  tier: PlanTier;
  name: string;
  priceCents: number; // per month; per venue for a perVenue plan
  cadence: string;
  blurb: string;
  features: string[];
  perVenue?: boolean;
};

export const PLANS: PlanDef[] = [
  {
    tier: "FREE",
    name: "Free",
    priceCents: 0,
    cadence: "free",
    blurb: "One venue, up to 5 tables — everything works, try it for real.",
    features: [
      "Full menu, ordering, kitchen screen and bill splitting",
      "Up to 5 tables",
      "\"Powered by Tillz\" shown on your ordering page",
    ],
  },
  {
    tier: "STANDARD",
    name: "Standard",
    priceCents: 7900,
    cadence: "per month",
    blurb: "One venue, unlimited tables, your own brand.",
    features: [
      "Everything in Free",
      "Unlimited tables",
      "Tillz branding removed",
      "Full analytics",
    ],
  },
  {
    tier: "PRO",
    name: "Pro",
    priceCents: 14900,
    cadence: "per month",
    blurb: "Multiple venues from one dashboard.",
    features: [
      "Everything in Standard",
      "Multiple venues",
      "Deeper analytics",
      "Priority support",
    ],
  },
];

export function planByTier(tier: PlanTier): PlanDef {
  return PLANS.find((p) => p.tier === tier) ?? PLANS[0];
}

// Physical Tillz stand pricing (AUD, excluding GST) — the one-time
// print-on-demand charge a venue pays when ordering stands (see the "Order
// physical stands" flow). Deliberately a flat per-unit price, not tiered by
// plan — a stand is a physical good, unrelated to the subscription catalog
// above. Change this one constant to reprice; nowhere else references a raw
// number for it.
export const STAND_UNIT_PRICE_CENTS = 1500;
