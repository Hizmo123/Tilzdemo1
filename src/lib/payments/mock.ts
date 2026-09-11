import { randomBytes } from "crypto";
import type {
  PaymentProvider,
  CreatePaymentInput,
  PaymentResult,
  PaymentIntentStatus,
} from "./provider";

// A sandbox provider that always succeeds. It moves no real money and is the
// only provider wired up until the real Australian provider is integrated in a
// later milestone. Every result carries test:true so the UI can label it as a
// test charge (spec §49, §93). Idempotency is enforced one level up, in the
// bill service, by refusing to pay an already-paid bill.
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
  readonly isTest = true;

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    const ref = `mock_${randomBytes(9).toString("hex")}`;
    return {
      providerRef: ref,
      status: "SUCCEEDED",
      amountCents: input.amountCents,
      currency: input.currency,
      test: true,
    };
  }

  async getPaymentStatus(): Promise<PaymentIntentStatus> {
    return "SUCCEEDED";
  }
}
