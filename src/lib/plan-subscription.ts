import type { PlanTier } from "@prisma/client";

// The one shape of "this organisation is now on tier X" under the MOCK
// billing model — used by the Billing page's plan switcher and by the
// onboarding wizard's plan step, so the two can't drift (e.g. one setting
// planStatus and the other forgetting to). No card, no charge; Lite is a
// real "active" plan, not a no-subscription state, so publish gating
// (isOrgSubscribed) treats every tier chosen here the same way.
// TODO(stripe): once real billing lands this becomes "what to write after
// Stripe confirms the subscription" — the callers stay as they are.

// The 14-day trial's single source of truth for length — read by both the
// Billing page and the marketing homepage's pricing section, never
// hardcoded a second time.
export const TRIAL_DAYS = 14;

// Which tiers a free trial ever applies to. LITE is free forever (nothing
// to trial); CONNECT has no subscription either — a flat per-order fee is
// its only relationship with Tillz, not a monthly charge a trial could
// defer.
export const TRIALABLE_TIERS: readonly PlanTier[] = ["BASIC", "GROWTH", "PRO"];

export function isTrialableTier(tier: PlanTier): boolean {
  return TRIALABLE_TIERS.includes(tier);
}

export function mockSubscriptionData(tier: PlanTier, hasUsedTrial: boolean) {
  const trialable = isTrialableTier(tier);
  // The org's ONE trial, ever — re-subscribing after cancelling back to
  // Lite must not grant a second one (hasUsedTrial is never cleared by
  // cancelSubscription, only set here, once, and never unset).
  const startsTrial = trialable && !hasUsedTrial;

  return {
    plan: tier,
    planStatus: "active" as const,
    cardLast4: null,
    subscribedAt: new Date(),
    // Clears a prior lapse — without this, an org that fell behind and then
    // re-subscribes kept entitlementsForTier treating it as still lapsed
    // forever (subscriptionLapsedAt is only ever SET elsewhere, never
    // cleared), since nothing else in this shape touches it.
    subscriptionLapsedAt: null,
    // TODO(stripe): once real billing lands, a trial becomes a real Stripe
    // trialing subscription (no charge collected until trialEndsAt) instead
    // of just this local date — and something must actually charge or
    // downgrade the org AT trialEndsAt. Today, under the mock model, a
    // trial simply keeps reading as ordinary "active" service past its end
    // date (planStatus never changes) — only the trial BADGE (see
    // getTrialStatus below) stops showing once trialEndsAt has passed.
    trialEndsAt: startsTrial
      ? new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
      : trialable
        ? undefined // mid-trial tier switch (e.g. Basic -> Growth) or an already-lapsed trial — leave whatever's there
        : null, // LITE/CONNECT: never show a stale trial left over from a previous paid tier
    ...(startsTrial ? { hasUsedTrial: true } : {}),
  };
}

export type TrialStatus =
  | { inTrial: false }
  | { inTrial: true; daysRemaining: number; endsAt: Date };

// Pure — reads only the two org fields, so both a Server Component (Billing,
// dashboard layout) and anything client-side can compute the same badge
// state from the same plain data. Returns inTrial: false past trialEndsAt
// (see mockSubscriptionData's TODO(stripe) above) — the mock model never
// stops service at that point, so the badge just stops claiming one exists.
export function getTrialStatus(org: { plan: PlanTier; trialEndsAt: Date | null }): TrialStatus {
  if (!isTrialableTier(org.plan) || !org.trialEndsAt) return { inTrial: false };
  const msRemaining = org.trialEndsAt.getTime() - Date.now();
  if (msRemaining <= 0) return { inTrial: false };
  const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
  return { inTrial: true, daysRemaining, endsAt: org.trialEndsAt };
}
