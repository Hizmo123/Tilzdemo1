import type { PlanTier } from "@prisma/client";

// The subscription catalog (AUD, excluding GST). Prices are wired through the
// mock billing flow so the whole signup -> choose plan -> pay journey works
// end to end today; real Stripe Billing replaces the checkout behind the
// same PLANS/planByTier surface, not the catalog itself.
//
// 4-tier model (see lib/entitlements.ts for the enforced rules this copy
// describes): LITE is deliberately menu-only, no live ordering at all —
// unlike the old 3-tier model, restricting the core loop on the entry tier
// is now an intentional part of the product, not something this module's
// "never disable what works" rule would flag back.
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
    tier: "LITE",
    name: "Lite",
    priceCents: 0,
    cadence: "free",
    blurb: "One venue, a view-only digital menu — no live ordering.",
    features: [
      "Full menu with photos, prices and dietary badges",
      "One QR/NFC code for every table",
      "\"Powered by Tillz\" shown on your menu page",
    ],
  },
  {
    tier: "BASIC",
    name: "Basic",
    priceCents: 4900,
    cadence: "per month",
    blurb: "One venue, live ordering for smaller floors.",
    features: [
      "Full ordering, kitchen screen and bill splitting",
      "Up to 25 tables, 2 kitchen stations",
      "Last 14 days of analytics",
      "\"Powered by Tillz\" shown on your ordering page",
    ],
  },
  {
    tier: "GROWTH",
    name: "Growth",
    priceCents: 9900,
    cadence: "per month",
    blurb: "One venue, unlimited tables, your own brand.",
    features: [
      "Everything in Basic",
      "Unlimited tables and kitchen stations",
      "Tillz branding removed",
      "Full analytics history",
    ],
  },
  {
    tier: "PRO",
    name: "Pro",
    priceCents: 14900,
    cadence: "per month",
    blurb: "Up to 3 venues from one dashboard, more as you grow.",
    features: [
      "Everything in Growth",
      "3 venues included — extra venues $49.99/mo each",
      "Priority support",
    ],
  },
];

export function planByTier(tier: PlanTier): PlanDef {
  return PLANS.find((p) => p.tier === tier) ?? PLANS[0];
}

// Price for one physical Tillz stand, ordered from the dashboard (spec: the
// order/fulfilment addendum). Flat, regardless of plan tier or quantity.
export const STAND_UNIT_PRICE_CENTS = 2900;

// Price for each Pro venue beyond the 3 included — see
// lib/entitlements.ts#canCreateVenue's requiresPayment result. Mock billing
// only today; no charge is ever actually made.
// TODO(stripe): wire this into a real per-venue subscription line item.
export const EXTRA_VENUE_PRICE_CENTS = 4999;
