import type { BillingProvider } from "./provider";
import { StubBillingProvider } from "./stub";

// Single place that decides which provider is active — same factory pattern
// as lib/payments/index.ts. Today it's always the stub; once a real
// StripeBillingProvider exists, this is the only line that changes.
let cached: BillingProvider | null = null;

export function getBillingProvider(): BillingProvider {
  if (!cached) cached = new StubBillingProvider();
  return cached;
}

export type { BillingProvider } from "./provider";
export { paidPlansOpen, PAID_PLANS_CLOSED_MESSAGE, SELF_ASSIGNABLE_GATED_TIERS } from "./gate";
export { stripePriceForTier, stripePriceForExtraVenue } from "./prices";
