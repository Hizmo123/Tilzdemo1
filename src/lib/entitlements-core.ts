import type { PlanTier } from "@prisma/client";

// The pure, database-free half of lib/entitlements.ts: the tier table and
// the function that turns a tier into an Entitlements object. Split out so
// client components (the onboarding wizard's plan step needs "does this tier
// include ordering?" to decide which steps to show) can import it without
// dragging Prisma into a browser bundle. lib/entitlements.ts re-exports
// everything here, so existing server imports are unchanged — and the rules
// still live in exactly one place.

const GRACE_PERIOD_DAYS = 7;

export type Entitlements = {
  tier: PlanTier;
  ordering: boolean; // false only for LITE — no tables, no bills, no KDS.
  tableLimit: number | null; // null = unlimited
  kdsStationLimit: number | null;
  venueLimit: number | null;
  analyticsWindowDays: number | null; // null = full history, 0 = none
  showTillzBranding: boolean;
  prioritySupport: boolean;
  // Tillz's own per-order application fee, in basis points, applied on top
  // of a Square-connected charge (chargeBillViaSquare) — see
  // TIER_LIMITS below for why this is 0 everywhere except CONNECT.
  appFeeBps: number;
  // true only for CONNECT: the entire tier IS a Square connection — there
  // is no Tillz-payments fallback. Onboarding makes the Connect step
  // mandatory (see lib/onboarding-options.ts#planRequiresSquare), and the
  // publish gate (isOrgSubscribed) additionally requires an active,
  // non-revoked SquareConnection before a Connect org can go live.
  requiresSquare: boolean;
  // The basic cross-venue view (name/today's sales/live-offline status, no
  // deep reporting) — free the moment a tier's own venue capacity allows
  // more than one venue. Derived from venueLimit, not a tier-name check, so
  // it stays correct if venue limits ever change: true for PRO and for
  // CONNECT (both venueLimit !== 1 today), false for LITE/BASIC/GROWTH.
  crossVenueList: boolean;
  // The DEEPER cross-venue dashboard — trends, cross-venue comparisons,
  // combined exports. Always true on PRO (bundled in the subscription);
  // true on CONNECT only when the org has paid for the Connect Plus addon
  // (Organization.connectPlusEnabled) — a base Connect org gets
  // crossVenueList but not this. False on every other tier.
  crossVenueDashboard: boolean;
  // Lapsed-subscription state (spec B4). `lapsed` alone doesn't stop
  // anything — existing service and read access keep running through the
  // grace period. Only `orderingBlocked` (lapsed AND past the grace period)
  // should ever gate a customer placing a NEW order; nothing else checks it.
  lapsed: boolean;
  graceEndsAt: Date | null;
  orderingBlocked: boolean;
};

// appFeeBps is 0 on every subscription tier (LITE/BASIC/GROWTH/PRO) — a
// paying subscriber who ALSO connects their own Square (for payment
// convenience or a catalog import) must never be charged a per-order fee
// on top of what they already pay monthly; that would be double-dipping
// the same revenue relationship. Only CONNECT — no subscription at all —
// carries a nonzero fee, since it's Tillz's only revenue from that org.
const TIER_LIMITS: Record<
  PlanTier,
  {
    ordering: boolean;
    tableLimit: number | null;
    kdsStationLimit: number | null;
    venueLimit: number | null;
    analyticsWindowDays: number | null;
    showTillzBranding: boolean;
    prioritySupport: boolean;
    appFeeBps: number;
    requiresSquare: boolean;
  }
> = {
  LITE: {
    ordering: false,
    tableLimit: 0,
    kdsStationLimit: 0,
    venueLimit: 1,
    analyticsWindowDays: 0,
    showTillzBranding: true,
    prioritySupport: false,
    appFeeBps: 0,
    requiresSquare: false,
  },
  BASIC: {
    ordering: true,
    tableLimit: 25,
    kdsStationLimit: 2,
    venueLimit: 1,
    analyticsWindowDays: 14,
    showTillzBranding: true,
    prioritySupport: false,
    appFeeBps: 0,
    requiresSquare: false,
  },
  GROWTH: {
    ordering: true,
    tableLimit: null,
    kdsStationLimit: null,
    venueLimit: 1,
    analyticsWindowDays: null,
    showTillzBranding: false,
    prioritySupport: false,
    appFeeBps: 0,
    requiresSquare: false,
  },
  PRO: {
    ordering: true,
    tableLimit: null,
    kdsStationLimit: null,
    venueLimit: 3,
    analyticsWindowDays: null,
    showTillzBranding: false,
    prioritySupport: true,
    appFeeBps: 0,
    requiresSquare: false,
  },
  // Unlimited tables (kdsStationLimit: 0, tableLimit: null) — no Tillz KDS
  // burden either way, since Square owns the kitchen for this tier (see
  // the PlanTier.CONNECT schema comment); no reason to also cap tables.
  // venueLimit: null (unlimited), unlike every subscription tier, which
  // caps venues because each one costs the org another subscription seat —
  // Connect has no subscription at all; each venue connects its own Square
  // account independently and Tillz's revenue scales with the per-order fee
  // regardless of venue count, so there's nothing to gate here. This also
  // activates entitlements.crossVenueList (venueLimit !== 1) for CONNECT —
  // canCreateVenue's generic `venueLimit === null` branch already returns
  // allowed with no payment required, same as it always has for any
  // unlimited tier; only PRO has the paid-addon-past-3 special case.
  CONNECT: {
    ordering: true,
    tableLimit: null,
    kdsStationLimit: 0,
    venueLimit: null,
    analyticsWindowDays: 14,
    showTillzBranding: true,
    prioritySupport: false,
    appFeeBps: 200, // 2% — the org's only revenue relationship with Tillz on this tier.
    requiresSquare: true,
  },
};

// The two CONNECT-only mock addons (see the Organization schema comment) —
// both default to false, so calling entitlementsForTier without this
// param (every non-CONNECT caller, and any CONNECT caller before the org's
// addon flags have been read) is identical to "no addons purchased".
export type EntitlementAddons = {
  connectPlusEnabled?: boolean;
  connectBrandingHidden?: boolean;
};

export function entitlementsForTier(
  tier: PlanTier,
  lapse: { lapsedAt: Date | null } = { lapsedAt: null },
  addons: EntitlementAddons = {},
): Entitlements {
  const base = TIER_LIMITS[tier] ?? TIER_LIMITS.LITE;
  const lapsedAt = lapse.lapsedAt;
  const lapsed = lapsedAt !== null;
  const graceEndsAt = lapsedAt
    ? new Date(lapsedAt.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
    : null;
  const orderingBlocked = graceEndsAt !== null && graceEndsAt.getTime() < Date.now();

  // appFeeBps (base.appFeeBps, 200 for CONNECT / 0 elsewhere) is NEVER
  // touched by either addon below — Connect Plus and branding removal are
  // pure feature/cosmetic upsells layered on the same flat fee, not fee
  // discounts. Both addons only ever affect crossVenueDashboard and
  // showTillzBranding, computed here, nowhere near appFeeBps.
  const crossVenueList = base.venueLimit !== 1;
  const crossVenueDashboard =
    tier === "PRO" || (tier === "CONNECT" && addons.connectPlusEnabled === true);
  const showTillzBranding =
    tier === "CONNECT" && addons.connectBrandingHidden === true ? false : base.showTillzBranding;
  // Connect Plus unlocks full history on top of the base 14-day CONNECT
  // window, same as Growth/Pro — same addon-check pattern as
  // crossVenueDashboard above.
  const analyticsWindowDays =
    tier === "CONNECT" && addons.connectPlusEnabled === true ? null : base.analyticsWindowDays;

  return {
    tier,
    ...base,
    showTillzBranding,
    analyticsWindowDays,
    crossVenueList,
    crossVenueDashboard,
    lapsed,
    graceEndsAt,
    orderingBlocked,
  };
}

export function entitlementsLabel(tier: PlanTier): string {
  switch (tier) {
    case "LITE":
      return "Lite";
    case "BASIC":
      return "Basic";
    case "GROWTH":
      return "Growth";
    case "PRO":
      return "Pro";
    case "CONNECT":
      return "Connect";
  }
}
