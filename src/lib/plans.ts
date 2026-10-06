import type { PlanTier } from "@prisma/client";
import { entitlementsForTier, connectFeePercentLabel } from "@/lib/entitlements-core";
import { BRAND } from "@/lib/brand";

// The one string every Connect pricing snippet across marketing, venue
// setup and billing renders — "1.5% of the order subtotal, excluding
// tips" — so none of them can independently drift from the actual charged
// rate the way "~2%" did before. States the BASE explicitly (goods/
// subtotal only — see computeAppFeeCents in lib/square/pay.ts, which is
// what this copy actually describes) rather than the ambiguous "per
// order", which a merchant could reasonably read as including their tip.
// The percentage is derived from CONNECT_APP_FEE_BPS via
// connectFeePercentLabel(); only the wording around it is a literal.
export const CONNECT_FEE_BLURB = `${connectFeePercentLabel()} of the order subtotal, excluding tips`;

// The subscription catalog (AUD, excluding GST). Prices are wired through the
// mock billing flow so the whole signup -> choose plan -> pay journey works
// end to end today; real Stripe Billing replaces the checkout behind the
// same PLANS/planByTier surface, not the catalog itself.
//
// 3-tier public model (see lib/entitlements.ts for the enforced rules this
// copy describes): LITE is deliberately menu-only, no live ordering at all.
// BASIC and CONNECT are grandfathered — hidden here below (`hidden: true`),
// never offered to a new signup or shown on public pricing, but their
// TIER_LIMITS entry in entitlements-core.ts is untouched, so an existing org
// on either tier keeps working exactly as before (see ALL_PLANS/PLANS split
// below for why their PlanDef still has to exist, not just their
// entitlements).
export type PlanDef = {
  tier: PlanTier;
  name: string;
  priceCents: number; // per month; per venue for a perVenue plan
  cadence: string;
  blurb: string;
  features: string[];
  perVenue?: boolean;
  // true = grandfathered only: never shown on public pricing or any
  // new-signup/upgrade picker. The tier itself keeps working — this flag
  // only controls where its PlanDef is offered, not its entitlements.
  hidden?: boolean;
};

// The full catalog, including grandfathered tiers — this is what a
// grandfathered org's current-plan display, the admin plan-assignment tool,
// and admin MRR-by-tier reporting all need (none of those are "public
// pricing" or a "new signup/upgrade picker", so they stay on the full list).
export const ALL_PLANS: PlanDef[] = [
  {
    tier: "LITE",
    name: "Lite",
    priceCents: 0,
    cadence: "free",
    blurb: "One venue, a view-only digital menu — no live ordering.",
    features: [
      "Full menu with photos, prices and dietary badges",
      "One QR/NFC code for every table",
      `"${BRAND.poweredBy}" shown on your menu page`,
    ],
  },
  {
    tier: "BASIC",
    name: "Basic",
    priceCents: 4900,
    cadence: "per month",
    blurb: "One venue, live ordering for smaller floors.",
    hidden: true,
    features: [
      "Full ordering, kitchen screen and bill splitting",
      "Up to 25 tables, 2 kitchen stations",
      "Last 14 days of analytics",
      `"${BRAND.poweredBy}" shown on your ordering page`,
    ],
  },
  {
    tier: "GROWTH",
    name: "Growth",
    priceCents: 7900,
    cadence: "per month",
    blurb: "One venue, unlimited tables, your own brand.",
    features: [
      "Full ordering, kitchen screen and bill splitting",
      "Unlimited tables and kitchen stations",
      "Full analytics history",
      `${BRAND.name} branding removed`,
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
    cadence: `free + ${CONNECT_FEE_BLURB}`,
    blurb: "Connect your own Square — free monthly, a small fee per order.",
    hidden: true,
    features: [
      "Orders + payments settle to your own Square account",
      "Orders appear on your Square kitchen/POS",
      "No monthly fee — pay only as you sell",
      `"${BRAND.poweredBy}" shown on your ordering page`,
      "Addon: Connect Plus — full cross-venue dashboard",
      `Addon: remove "${BRAND.poweredBy}" branding`,
    ],
  },
];

// Public catalog — what the marketing pricing page and every new-signup /
// upgrade picker render. Exactly LITE, GROWTH, PRO today; Connect is reached
// separately through the "pay as you sell" strip's own Square-first flow,
// never as a card in this list (see pricing-grid.tsx / plan-picker.tsx).
export const PLANS: PlanDef[] = ALL_PLANS.filter((p) => !p.hidden);

// "Pay as you sell" — not a plan card (Connect's PlanDef above still backs
// the dashboard Billing grid for an existing Connect org, and the Square-
// first picker strip derives its own copy from CONNECT_FEE_BLURB directly),
// just the one shared sentence both the marketing strip and the onboarding
// plan step's Connect CTA render so they can't say different things about
// the same per-order fee.
export const PAY_AS_YOU_SELL_BLURB = `Free monthly. ${CONNECT_FEE_BLURB} on your own Square. Cancel any time.`;

export function planByTier(tier: PlanTier): PlanDef {
  return ALL_PLANS.find((p) => p.tier === tier) ?? ALL_PLANS[0];
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

// Price for one physical Tap-to-It stand, ordered from the dashboard (spec: the
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
        ? `"${BRAND.poweredBy}" shown on your ordering page`
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
      value: `${CONNECT_FEE_BLURB} — your only cost, no monthly subscription`,
    });

    const withPlus = entitlementsForTier("CONNECT", { lapsedAt: null }, { connectPlusEnabled: true });
    lines.push({
      label: "Addon: Connect Plus",
      value: `${centsToPriceLabel(CONNECT_PLUS_PRICE_CENTS)}/mo — full cross-venue dashboard${
        withPlus.analyticsWindowDays === null ? ", unlimited analytics history" : ""
      }`,
    });

    lines.push({
      label: `Addon: remove "${BRAND.poweredBy}"`,
      value: `${centsToPriceLabel(CONNECT_BRANDING_REMOVAL_PRICE_CENTS)}/mo — hides the ${BRAND.name} mark from your ordering page`,
    });
  }

  return lines;
}
