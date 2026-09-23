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
  },
  // Unlimited tables (kdsStationLimit: 0, tableLimit: null) — no Tillz KDS
  // burden either way, since Square owns the kitchen for this tier (see
  // the PlanTier.CONNECT schema comment); no reason to also cap tables.
  CONNECT: {
    ordering: true,
    tableLimit: null,
    kdsStationLimit: 0,
    venueLimit: 1,
    analyticsWindowDays: 14,
    showTillzBranding: true,
    prioritySupport: false,
    appFeeBps: 200, // 2% — the org's only revenue relationship with Tillz on this tier.
  },
};

export function entitlementsForTier(
  tier: PlanTier,
  lapse: { lapsedAt: Date | null } = { lapsedAt: null },
): Entitlements {
  const base = TIER_LIMITS[tier] ?? TIER_LIMITS.LITE;
  const lapsedAt = lapse.lapsedAt;
  const lapsed = lapsedAt !== null;
  const graceEndsAt = lapsedAt
    ? new Date(lapsedAt.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
    : null;
  const orderingBlocked = graceEndsAt !== null && graceEndsAt.getTime() < Date.now();

  return {
    tier,
    ...base,
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
