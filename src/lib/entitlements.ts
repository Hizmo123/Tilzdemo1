import type { PlanTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// The one authoritative place that answers "what is this organisation
// allowed to do" — every server action and every UI element that needs a
// plan-based answer reads from here, never from `org.plan` directly, so the
// actual rules live in exactly one place instead of scattering across the
// codebase as ad hoc `if (plan === "FREE")` checks.
//
// Ground rule (non-negotiable): tier limits are about SCALE and POLISH —
// table count, venue count, the Tillz branding mark — never about disabling
// the core ordering loop. QR ordering, the kitchen display, order routing
// and bill splitting are unrestricted on every tier including Free. Full
// analytics is ALSO left unrestricted here even though the original plan
// spec described it as a Standard+ feature — it already works for every
// venue today, and restricting it would remove working behaviour rather
// than add a new one, which the spec's own rule says to flag instead of
// silently build. Flagged back; not implemented.

const GRACE_PERIOD_DAYS = 7;

export type Entitlements = {
  tier: PlanTier;
  tableLimit: number | null; // null = unlimited
  venueLimit: number | null;
  showTillzBranding: boolean;
  prioritySupport: boolean;
  // Lapsed-subscription state (spec B4). `lapsed` alone doesn't stop
  // anything — existing service and read access keep running through the
  // grace period. Only `orderingBlocked` (lapsed AND past the grace period)
  // should ever gate a customer placing a NEW order; nothing else checks it.
  lapsed: boolean;
  graceEndsAt: Date | null;
  orderingBlocked: boolean;
};

const TIER_LIMITS: Record<
  PlanTier,
  { tableLimit: number | null; venueLimit: number | null; showTillzBranding: boolean; prioritySupport: boolean }
> = {
  FREE: { tableLimit: 5, venueLimit: 1, showTillzBranding: true, prioritySupport: false },
  STANDARD: { tableLimit: null, venueLimit: 1, showTillzBranding: false, prioritySupport: false },
  PRO: { tableLimit: null, venueLimit: null, showTillzBranding: false, prioritySupport: true },
};

export function entitlementsForTier(
  tier: PlanTier,
  lapse: { lapsedAt: Date | null } = { lapsedAt: null },
): Entitlements {
  const base = TIER_LIMITS[tier] ?? TIER_LIMITS.FREE;
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

export async function getEntitlements(organizationId: string): Promise<Entitlements> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true, subscriptionLapsedAt: true },
  });
  if (!org) return entitlementsForTier("FREE");
  return entitlementsForTier(org.plan, { lapsedAt: org.subscriptionLapsedAt });
}

// Only blocks CREATING a table beyond the limit — never hides or disables
// tables an organisation already has, even if a new/lower limit means
// they're already over it (e.g. downgraded from Pro to Free with 8 tables).
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
      reason: `The ${entitlementsLabel(ent.tier)} plan includes up to ${ent.tableLimit} tables. Upgrade to add more.`,
    };
  }
  return { allowed: true };
}

export async function canCreateVenue(
  organizationId: string,
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const ent = await getEntitlements(organizationId);
  if (ent.venueLimit === null) return { allowed: true };

  const count = await prisma.restaurant.count({ where: { organizationId } });
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

function entitlementsLabel(tier: PlanTier): string {
  return tier === "FREE" ? "Free" : tier === "STANDARD" ? "Standard" : "Pro";
}
