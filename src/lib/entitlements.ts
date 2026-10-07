import { cache } from "react";
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

// cache()'d: this request-scoped memoization is why calling getEntitlements
// from the dashboard layout AND from a page (and again from inside
// getPublishReadiness below) doesn't cost 3-4 separate organization.
// findUnique round trips — React dedupes by argument (organizationId) within
// one request, so every call with the same id after the first just reuses
// the in-flight/resolved promise. Nothing about the function's behaviour or
// return value changes; nothing downstream needed to change either.
export const getEntitlements = cache(async (organizationId: string): Promise<Entitlements> => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      plan: true,
      subscriptionLapsedAt: true,
      connectPlusEnabled: true,
      connectBrandingHidden: true,
    },
  });
  if (!org) return entitlementsForTier("LITE");
  return entitlementsForTier(
    org.plan,
    { lapsedAt: org.subscriptionLapsedAt },
    { connectPlusEnabled: org.connectPlusEnabled, connectBrandingHidden: org.connectBrandingHidden },
  );
});

// Only blocks CREATING a table beyond the limit — never hides or disables
// tables an organisation already has, even if a new/lower limit means
// they're already over it (e.g. downgraded from Pro to Basic with 40 tables).
// Taking away something that already works is exactly what this module
// exists to prevent.
//
// Also the gate setTableActive calls before REACTIVATING a table
// (context: "reactivate") — both ask the exact same question ("would this
// push active tables past the limit?"), just from different UI actions, so
// they share the count query and only the wording differs: a brand-new
// table only has "upgrade" as a next step, but a reactivation can also just
// deactivate a different one first.
export async function canCreateTable(
  organizationId: string,
  context: "create" | "reactivate" = "create",
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const ent = await getEntitlements(organizationId);
  if (ent.tableLimit === null) return { allowed: true };

  const count = await prisma.table.count({
    where: { active: true, location: { restaurant: { organizationId } } },
  });
  if (count >= ent.tableLimit) {
    if (ent.tableLimit === 0) {
      return {
        allowed: false,
        reason: `The ${entitlementsLabel(ent.tier)} plan doesn't include live ordering. Upgrade to add tables.`,
      };
    }
    return {
      allowed: false,
      reason:
        context === "reactivate"
          ? `You're at your plan's limit of ${ent.tableLimit} active tables. Deactivate another table first, or upgrade.`
          : `The ${entitlementsLabel(ent.tier)} plan includes up to ${ent.tableLimit} tables. Upgrade to add more.`,
    };
  }
  return { allowed: true };
}

// Same "never take away what already works" rule as canCreateTable, applied
// to kitchen prep stations (Restaurant.kitchenStations).
//
// Answers "may this restaurant have `requestedCount` stations", not "may I
// add one more" — the caller (updateKitchenStations) writes a whole
// submitted array in one call, so a check that only compared the CURRENT
// count against the limit (the old canCreateStation) let a BASIC org
// sitting at 1 of 2 stations write 26 in a single save (1 >= 2 is false,
// and the array replace itself was unchecked). Comparing the requested
// total directly closes that regardless of how many are added at once.
//
// Also takes restaurantId explicitly and verifies it belongs to
// organizationId, rather than resolving "the org's restaurant" internally
// via `findFirst({ where: { organizationId } })` — on a multi-venue
// PRO/CONNECT org that resolved an ARBITRARY venue, not necessarily the one
// actually being edited. The entitlement limit itself is still org-level
// (kdsStationLimit comes from the plan, not the venue), so this ownership
// check exists purely so a mismatched restaurantId can never sneak past
// silently rather than to look up anything restaurant-specific.
export async function canSetStations(
  organizationId: string,
  restaurantId: string,
  requestedCount: number,
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { organizationId: true },
  });
  if (!restaurant || restaurant.organizationId !== organizationId) {
    return { allowed: false, reason: "Restaurant not found." };
  }

  const ent = await getEntitlements(organizationId);
  if (ent.kdsStationLimit === null) return { allowed: true };

  if (requestedCount > ent.kdsStationLimit) {
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
// cache()'d for the same reason as getEntitlements — called standalone AND
// from inside getPublishReadiness, which would otherwise be two queries.
export const isOrgSubscribed = cache(async (organizationId: string): Promise<boolean> => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true, planStatus: true, subscriptionLapsedAt: true },
  });
  if (!org) return false;
  if (org.planStatus !== "active") return false;

  const ent = entitlementsForTier(org.plan, { lapsedAt: org.subscriptionLapsedAt });
  return !ent.orderingBlocked;
});

export type PublishReadiness =
  | { ready: true }
  | { ready: false; reason: "unsubscribed" }
  // CONNECT only: isOrgSubscribed alone isn't enough to go live — there's
  // no charge to be "subscribed" to on this tier, so its actual live-or-not
  // precondition is a working Square connection instead. Also the state a
  // previously-published Connect venue falls into if the owner disconnects
  // Square (or revokes it from Square's own dashboard — see the
  // oauth.authorization.revoked webhook) after going live: existing orders
  // already fail their Square charge with a friendly error either way
  // (chargeBillViaSquare requires the connection), so this is the publish-
  // time half of "unable to take orders until reconnected", not a new
  // runtime block on its own.
  | { ready: false; reason: "square_disconnected" };

// The single source of truth for "can this org's venue actually go live" —
// publishRestaurant uses this as the real gate; dashboard/page.tsx uses it
// to decide what PublishControl shows. Composes isOrgSubscribed (unchanged,
// still the generic billing check other callers use on its own) with a
// CONNECT-specific Square check, rather than folding Square into
// isOrgSubscribed itself — "subscribed" and "has a working Square
// connection" are different preconditions that happen to both gate publish.
export async function getPublishReadiness(organizationId: string): Promise<PublishReadiness> {
  const subscribed = await isOrgSubscribed(organizationId);
  if (!subscribed) return { ready: false, reason: "unsubscribed" };

  const ent = await getEntitlements(organizationId);
  if (ent.requiresSquare) {
    const restaurant = await prisma.restaurant.findFirst({
      where: { organizationId },
      select: { id: true },
    });
    const connection = restaurant
      ? await prisma.squareConnection.findUnique({
          where: { restaurantId: restaurant.id },
          select: { revokedAt: true, locationId: true },
        })
      : null;
    if (!connection || connection.revokedAt || !connection.locationId) {
      return { ready: false, reason: "square_disconnected" };
    }
  }
  return { ready: true };
}
