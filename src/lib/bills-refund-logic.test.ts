import { describe, it, expect } from "vitest";
import { computeOrderRefundTargetCents } from "@/lib/bills";

// Regression test for Phase 2.2: cancelling/rejecting an order used to
// delete its BillItems without refunding anything already paid toward
// them. computeOrderRefundTargetCents is the pure decision of HOW MUCH to
// refund, covering both ways an order's items can already be paid:
//  - item-split payment (paidQuantity on the order's own items) — exact.
//  - a prepay venue's lump-sum bill payment, which released the order from
//    its awaitingPayment gate without ever itemising which order it paid
//    for — inferred from wasReleasedFromPrepayGate.
describe("computeOrderRefundTargetCents", () => {
  it("returns 0 for an order with no item-split payment and not prepay-released", () => {
    const items = [{ paidQuantity: 0, quantity: 2, unitPriceCents: 500 }];
    expect(computeOrderRefundTargetCents(items, false)).toBe(0);
  });

  it("attributes exact item-split payments even when not prepay-released", () => {
    const items = [
      { paidQuantity: 1, quantity: 2, unitPriceCents: 500 },
      { paidQuantity: 0, quantity: 1, unitPriceCents: 300 },
    ];
    expect(computeOrderRefundTargetCents(items, false)).toBe(500);
  });

  it("refunds the order's FULL value when released from a prepay gate, even with no per-item paidQuantity", () => {
    const items = [
      { paidQuantity: 0, quantity: 2, unitPriceCents: 500 },
      { paidQuantity: 0, quantity: 1, unitPriceCents: 300 },
    ];
    expect(computeOrderRefundTargetCents(items, true)).toBe(1300);
  });

  it("takes the larger of the two signals if they somehow disagree", () => {
    const items = [{ paidQuantity: 2, quantity: 2, unitPriceCents: 500 }];
    expect(computeOrderRefundTargetCents(items, true)).toBe(1000);
  });
});
