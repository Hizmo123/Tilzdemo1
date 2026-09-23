import type { PlanTier } from "@prisma/client";

// The one shape of "this organisation is now on tier X" under the MOCK
// billing model — used by the Billing page's plan switcher and by the
// onboarding wizard's plan step, so the two can't drift (e.g. one setting
// planStatus and the other forgetting to). No card, no charge; Lite is a
// real "active" plan, not a no-subscription state, so publish gating
// (isOrgSubscribed) treats every tier chosen here the same way.
// TODO(stripe): once real billing lands this becomes "what to write after
// Stripe confirms the subscription" — the callers stay as they are.
export function mockSubscriptionData(tier: PlanTier) {
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
  };
}
