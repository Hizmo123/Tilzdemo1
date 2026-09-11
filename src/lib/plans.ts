import type { PlanTier } from "@prisma/client";

// The subscription catalog. Prices are placeholders you set for real once you
// know your processing costs — they're wired through the mock billing flow so
// the whole signup → choose plan → pay journey works end to end today.
export type PlanDef = {
  tier: PlanTier;
  name: string;
  priceCents: number; // per month; per venue for GROUP
  cadence: string;
  blurb: string;
  features: string[];
  perVenue?: boolean;
};

export const PLANS: PlanDef[] = [
  {
    tier: "FREE",
    name: "Starter",
    priceCents: 0,
    cadence: "free",
    blurb: "Set up and try it on a few tables.",
    features: [
      "Full menu, tables and QR codes",
      "Ordering, bill splitting and test payments",
      "Staff logins and kitchen screen",
    ],
  },
  {
    tier: "VENUE",
    name: "Venue",
    priceCents: 4900,
    cadence: "per month",
    blurb: "One venue, everything, live.",
    features: [
      "Everything in Starter",
      "Live payments to your account",
      "Unlimited tables, one flat price",
      "Analytics and branding",
    ],
  },
  {
    tier: "GROUP",
    name: "Group",
    priceCents: 3900,
    cadence: "per venue / month",
    perVenue: true,
    blurb: "Multiple venues, one dashboard.",
    features: [
      "Everything in Venue",
      "Multiple locations",
      "Per-venue pricing with a group discount",
    ],
  },
];

export function planByTier(tier: PlanTier): PlanDef {
  return PLANS.find((p) => p.tier === tier) ?? PLANS[0];
}
