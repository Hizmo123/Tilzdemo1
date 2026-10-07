import type { PlanTier } from "@prisma/client";
import { mockSubscriptionData } from "@/lib/plan-subscription";
import { getBillingProvider } from "./index";

export type StartSubscriptionResult =
  | { redirectUrl: string }
  | { mockData: ReturnType<typeof mockSubscriptionData> };

// Shared by subscribe() (an existing org switching plan from the Billing
// page) and completeOnboarding() (a brand-new org's first plan choice) —
// both need the exact same "try a real Checkout Session first, fall back to
// the mock instant-activate write if Stripe isn't configured" branch, so it
// lives here once rather than drifting between two copies.
export async function startSubscriptionOrMock(opts: {
  organizationId: string;
  tier: PlanTier;
  hasUsedTrial: boolean;
  successUrl: string;
  cancelUrl: string;
}): Promise<StartSubscriptionResult> {
  const checkout = await getBillingProvider().createCheckoutSession({
    organizationId: opts.organizationId,
    tier: opts.tier,
    successUrl: opts.successUrl,
    cancelUrl: opts.cancelUrl,
  });
  if (checkout.configured) {
    return { redirectUrl: checkout.url };
  }
  return { mockData: mockSubscriptionData(opts.tier, opts.hasUsedTrial) };
}
