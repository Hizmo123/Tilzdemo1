// Provider-agnostic payment abstraction (spec §13, §142, §143). The rest of the
// app depends only on this interface, never on a concrete provider, so the real
// Australian provider (Stripe test-mode, M3) can drop in without touching call
// sites. Amounts are integer cents.

export type PaymentIntentStatus = "PENDING" | "SUCCEEDED" | "FAILED";

export interface CreatePaymentInput {
  amountCents: number;
  currency: string;
  // Idempotency key — the same key must never charge twice (spec §15, §146).
  idempotencyKey: string;
  metadata?: Record<string, string>;
}

export interface PaymentResult {
  providerRef: string;
  status: PaymentIntentStatus;
  amountCents: number;
  currency: string;
  // True when this is a mock/test charge, so the UI can label it (spec §93).
  test: boolean;
}

export interface PaymentProvider {
  readonly name: string;
  readonly isTest: boolean;
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
  getPaymentStatus(providerRef: string): Promise<PaymentIntentStatus>;
}
