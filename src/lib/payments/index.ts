import type { PaymentProvider } from "./provider";
import { MockPaymentProvider } from "./mock";

// Single place that decides which provider is active. Today it's always the
// mock. When the real Australian provider (Stripe test-mode) lands, this factory
// switches on an env flag — no call site changes.
let cached: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (!cached) cached = new MockPaymentProvider();
  return cached;
}

export type { PaymentProvider } from "./provider";
