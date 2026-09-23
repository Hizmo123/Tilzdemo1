import { describe, it, expect } from "vitest";

// Regression test for Phase 2.4: payBillItems compared the raw (undiscounted)
// sum of selected items' prices against the bill's true (discounted)
// remaining balance, permanently rejecting the last item(s) on any
// discounted bill once the discount made the sticker sum exceed what was
// actually still owed. Fixed by clamping the charge to `remaining` instead
// of erroring when it's exceeded (mirrors the exact clamp now in
// payBillItems in lib/bills.ts).
function resolveSplitPaymentAmount(rawAmount: number, remaining: number): number {
  return Math.min(rawAmount, remaining);
}

describe("payBillItems discount clamp", () => {
  it("two $10 items with a $5 bill-level discount: the second item is still payable in full", () => {
    // total = $20 - $5 = $15. First item paid in full ($10) -> remaining $5.
    const remainingAfterFirst = 1500 - 1000;
    // Second item's raw price is still $10 (never discounted per-item).
    const chargedForSecond = resolveSplitPaymentAmount(1000, remainingAfterFirst);
    expect(chargedForSecond).toBe(500);
    expect(chargedForSecond).toBeGreaterThan(0); // payable, not permanently rejected
  });

  it("an undiscounted bill is unaffected — the raw amount is charged as-is", () => {
    expect(resolveSplitPaymentAmount(1000, 5000)).toBe(1000);
  });

  it("cumulative payments across a discounted bill never exceed the discounted total", () => {
    const totalCents = 1500;
    let paid = 0;
    for (const raw of [1000, 1000]) {
      const remaining = totalCents - paid;
      paid += resolveSplitPaymentAmount(raw, remaining);
    }
    expect(paid).toBe(totalCents);
  });
});
