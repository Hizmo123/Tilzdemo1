import type { PlanTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import { EXTRA_VENUE_PRICE_CENTS } from "@/lib/plans";

// The one authoritative place that answers "what is this organisation
// allowed to do" — every server action and every UI element that needs a
// plan-based answer reads from here, never from `org.plan` directly, so the
// actual rules live in exactly one place instead of scattering across the
// codebase as ad hoc `if (plan === "LITE")` checks.
//
// Plan model (4 tiers): LITE is deliberately menu-only — no live ordering at
// all, `ordering: false` — so the old "never disable the core ordering loop"
// rule from the 3-tier model no longer holds; a Lite org never had that loop
// to begin with. From BASIC upward, the same non-negotiable ground rule
// still applies to everything else here: limits are about SCALE and
// POLISH — table count, KDS station count, venue count, the Tillz branding
// mark, analytics history window — never about disabling something that
// already works once granted. Downgrading never deletes/hides existing
// tables, stations, or venues; it only blocks creating new ones past the
// (now lower) limit.

// The tier table itself (TIER_LIMITS), entitlementsForTier and
// entitlementsLabel live in lib/entitlements-core.ts — the Prisma-free half
// of this module — so client components can read tier rules without pulling
// the database client into their bundle. Re-exported here so every existing
// server-side import keeps working unchanged.
import { entitlementsForTier, entitlementsLabel, type Entitlements } from "@/lib/entitlements-core";
export { entitlementsForTier, entitlementsLabel, type Entitlements };

export async function getEntitlements(organizationId: string): Promise<Entitlements> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true, subscriptionLapsedAt: true },
  });
  if (!org) return entitlementsForTier("LITE");
  return entitlementsForTier(org.plan, { lapsedAt: org.subscriptionLapsedAt });
}

// Only blocks CREATING a table beyond the limit — never hides or disables
// tables an organisation already has, even if a new/lower limit means
// they're already over it (e.g. downgraded from Pro to Basic with 40 tables).
// Taking away something that already works is exactly what this module
// exists to prevent.
export async function canCreateTable(
  organizationId: string,
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const ent = await getEntitlements(organizationId);
  if (ent.tableLimit === null) return { allowed: true };

  const count = await prisma.table.count({
    where: { active: true, location: { restaurant: { organizationId } } },
  });
  if (count >= ent.tableLimit) {
    return {
      allowed: false,
      reason:
        ent.tableLimit === 0
          ? `The ${entitlementsLabel(ent.tier)} plan doesn't include live ordering. Upgrade to add tables.`
          : `The ${entitlementsLabel(ent.tier)} plan includes up to ${ent.tableLimit} tables. Upgrade to add more.`,
    };
  }
  return { allowed: true };
}

// Same "never take away what already works" rule as canCreateTable, applied
// to kitchen prep stations (Restaurant.kitchenStations). Stations live on
// Restaurant, not scoped through a location the way tables are, so this
// resolves the org's current restaurant the same way the rest of the app's
// single-venue-assumption code does today (restaurants[0]) — task E's
// active-venue cookie replaces that assumption everywhere else, not here.
export async function canCreateStation(
  organizationId: string,
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const ent = await getEntitlements(organizationId);
  if (ent.kdsStationLimit === null) return { allowed: true };

  const restaurant = await prisma.restaurant.findFirst({ where: { organizationId } });
  const count = restaurant?.kitchenStations.length ?? 0;
  if (count >= ent.kdsStationLimit) {
    return {
      allowed: false,
      reason:
        ent.kdsStationLimit === 0
          ? `The ${entitlementsLabel(ent.tier)} plan doesn't include a kitchen screen. Upgrade to add stations.`
          : `The ${entitlementsLabel(ent.tier)} plan includes up to ${ent.kdsStationLimit} kitchen station${ent.kdsStationLimit === 1 ? "" : "s"}. Upgrade to add more.`,
    };
  }
  return { allowed: true };
}

export type CreateVenueResult =
  | { allowed: true; requiresPayment?: false }
  | { allowed: true; requiresPayment: true; addonPriceLabel: string }
  | { allowed: false; reason: string };

// PRO admits stand-alone multi-venue growth past its 3 included venues, as a
// paid add-on per extra venue, rather than a hard wall — every other tier
// hits a hard wall at its venueLimit (upgrade to Pro is the only way past
// it). requiresPayment is a distinct, non-blocking result: the caller (task
// G's "+ Add venue" flow) decides how to collect confirmation/payment for
// it, this function only decides whether creating one more venue right now
// is (a) blocked, (b) free, or (c) allowed but chargeable.
export async function canCreateVenue(organizationId: string): Promise<CreateVenueResult> {
  const ent = await getEntitlements(organizationId);
  const count = await prisma.restaurant.count({ where: { organizationId } });

  if (ent.tier === "PRO") {
    if (count >= 3) {
      // TODO(stripe): once real billing lands, this is where creating the
      // venue should also add a EXTRA_VENUE_PRICE_CENTS/mo line item to the
      // org's subscription instead of just recording the venue for free
      // under the mock model.
      return {
        allowed: true,
        requiresPayment: true,
        addonPriceLabel: `${formatCents(EXTRA_VENUE_PRICE_CENTS)}/mo`,
      };
    }
    return { allowed: true };
  }

  if (ent.venueLimit === null) return { allowed: true };
  if (count >= ent.venueLimit) {
    return {
      allowed: false,
      reason:
        ent.venueLimit === 1
          ? "Your plan includes one venue. Upgrade to Pro for multiple venues."
          : `Your plan includes up to ${ent.venueLimit} venues. Upgrade for more.`,
    };
  }
  return { allowed: true };
}

// The single source of truth for "is this org actually subscribed" under the
// mock billing model — planStatus === "active" AND not lapsed past the
// grace period (same grace-period math as entitlementsForTier's
// orderingBlocked). Used by publishRestaurant (dashboard/actions.ts) to
// decide whether a venue is allowed to go live, and by anything else that
// needs the same yes/no answer.
// TODO(stripe): once real billing lands, replace this body with an actual
// subscription-status check against the payment provider — every caller
// keeps working unchanged since they only ever see the boolean result.
export async function isOrgSubscribed(organizationId: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true, planStatus: true, subscriptionLapsedAt: true },
  });
  if (!org) return false;
  if (org.planStatus !== "active") return false;

  const ent = entitlementsForTier(org.plan, { lapsedAt: org.subscriptionLapsedAt });
  return !ent.orderingBlocked;
}
