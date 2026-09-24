import type { PlanTier } from "@prisma/client";
import { entitlementsForTier } from "@/lib/entitlements-core";

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
  {
    tier: "CONNECT",
    name: "Connect",
    priceCents: 0,
    cadence: "free + ~2% per order",
    blurb: "Connect your own Square — free monthly, a small fee per order.",
    features: [
      "Orders + payments settle to your own Square account",
      "Orders appear on your Square kitchen/POS",
      "No monthly fee — pay only as you sell",
      "\"Powered by Tillz\" shown on your ordering page",
      "Addon: Connect Plus — full cross-venue dashboard",
      "Addon: remove \"Powered by Tillz\" branding",
    ],
  },
];

export function planByTier(tier: PlanTier): PlanDef {
  return PLANS.find((p) => p.tier === tier) ?? PLANS[0];
}

// Whole-dollar "$49" or "$4.99" (AUD), no cents when unnecessary. Shared by
// planPriceLabel below and getFullPlanSpec's addon pricing so every dollar
// figure on a pricing card renders the same way from the same helper.
export function centsToPriceLabel(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

// Display-only: "Free" or a whole-dollar "$49" (AUD). Shared by the
// marketing pricing section and the onboarding plan step so the two render
// the same figure the same way. Never used for arithmetic.
export function planPriceLabel(p: PlanDef): string {
  if (p.priceCents === 0) return "Free";
  return centsToPriceLabel(p.priceCents);
}

// Price for one physical Tillz stand, ordered from the dashboard (spec: the
// order/fulfilment addendum). Flat, regardless of plan tier or quantity.
export const STAND_UNIT_PRICE_CENTS = 2900;

// Price for each Pro venue beyond the 3 included — see
// lib/entitlements.ts#canCreateVenue's requiresPayment result. Mock billing
// only today; no charge is ever actually made.
// TODO(stripe): wire this into a real per-venue subscription line item.
export const EXTRA_VENUE_PRICE_CENTS = 4999;

// The two CONNECT-only mock addons (dashboard/billing/checkout.tsx's
// ConnectAddons toggles, lib/entitlements-core.ts's EntitlementAddons) — one
// source of truth for their price so the Billing toggles and
// getFullPlanSpec's "Full features" breakdown below can never quote
// different numbers for the same addon.
export const CONNECT_PLUS_PRICE_CENTS = 1900;
export const CONNECT_BRANDING_REMOVAL_PRICE_CENTS = 900;

export type PlanSpecLine = { label: string; value: string };

// The "Full features" expandable panel's content — every line DERIVED from
// entitlementsForTier (the same TIER_LIMITS table that actually gates the
// product), never a second hand-typed copy of what a tier includes. Addon
// lines re-derive their own "what it unlocks" text by calling
// entitlementsForTier again WITH that addon on, so if the addon's real
// effect ever changes (e.g. the Connect Plus analytics-window fix), this
// panel can't silently go stale.
export function getFullPlanSpec(tier: PlanTier): PlanSpecLine[] {
  const ent = entitlementsForTier(tier);

  const lines: PlanSpecLine[] = [
    {
      label: "Ordering",
      value: ent.ordering
        ? "Live ordering, kitchen screen and bill splitting"
        : "Digital menu only — no live ordering",
    },
    {
      label: "Tables",
      value:
        ent.tableLimit === null
          ? "Unlimited"
          : ent.tableLimit === 0
            ? "No tables (menu-only)"
            : `Up to ${ent.tableLimit}`,
    },
    {
      label: "Kitchen stations",
      value:
        ent.kdsStationLimit === null
          ? "Unlimited"
          : ent.kdsStationLimit === 0
            ? tier === "CONNECT"
              ? "None — Square owns your kitchen screen"
              : "None"
            : `${ent.kdsStationLimit}`,
    },
    {
      label: "Venues",
      value:
        ent.venueLimit === null
          ? tier === "CONNECT"
            ? "Unlimited — each venue connects its own Square account, no extra subscription"
            : "Unlimited"
          : ent.venueLimit === 1
            ? "1 venue"
            : `${ent.venueLimit} venues included — extra venues ${centsToPriceLabel(EXTRA_VENUE_PRICE_CENTS)}/mo each`,
    },
    {
      label: "Analytics history",
      value:
        ent.analyticsWindowDays === null
          ? "Full history"
          : ent.analyticsWindowDays === 0
            ? "None"
            : `Last ${ent.analyticsWindowDays} days`,
    },
    {
      label: "Branding",
      value: ent.showTillzBranding
        ? '"Powered by Tillz" shown on your ordering page'
        : "Removed — fully your own brand",
    },
    {
      label: "Support",
      value: ent.prioritySupport ? "Priority support" : "Standard support",
    },
  ];

  if (tier === "CONNECT") {
    lines.push({
      label: "Per-order fee",
      value: `${ent.appFeeBps / 100}% per order — your only cost, no monthly subscription`,
    });

    const withPlus = entitlementsForTier("CONNECT", { lapsedAt: null }, { connectPlusEnabled: true });
    lines.push({
      label: "Addon: Connect Plus",
      value: `${centsToPriceLabel(CONNECT_PLUS_PRICE_CENTS)}/mo — full cross-venue dashboard${
        withPlus.analyticsWindowDays === null ? ", unlimited analytics history" : ""
      }`,
    });

    lines.push({
      label: 'Addon: remove "Powered by Tillz"',
      value: `${centsToPriceLabel(CONNECT_BRANDING_REMOVAL_PRICE_CENTS)}/mo — hides the Tillz mark from your ordering page`,
    });
  }

  return lines;
}
