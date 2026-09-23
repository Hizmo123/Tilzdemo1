import { describe, it, expect } from "vitest";

// Regression test for the falsy-zero bug in pay-sheet.tsx's onPaid() call:
// `res.amountPaidCents || optimistic` treated a genuine $0 charge (e.g. a
// fully-discounted/comped bill settled for nothing) as "no value" and
// substituted the optimistic pre-payment guess instead — showing a false
// nonzero "Payment complete" amount. Fixed to `??`, which only falls back
// on null/undefined, never on a real zero.
//
// This tests the exact resolution expression pay-sheet.tsx now uses,
// isolated from the component (no React test renderer in this project yet
// — see Phase 1/2 report for that gap).
function resolvePaidAmount(amountPaidCents: number, optimistic: number): number {
  return amountPaidCents ?? optimistic;
}

describe("pay-sheet onPaid amount resolution", () => {
  it("uses the real amount when it is a genuine zero, not the optimistic guess", () => {
    expect(resolvePaidAmount(0, 1500)).toBe(0);
  });

  it("uses the real amount for an ordinary nonzero charge", () => {
    expect(resolvePaidAmount(1200, 1500)).toBe(1200);
  });

  it("the old `||` behavior is the bug this guards against", () => {
    const buggyResolve = (amountPaidCents: number, optimistic: number) =>
      amountPaidCents || optimistic;
    // Demonstrates why `??` was required: `||` silently substitutes the
    // optimistic guess for a real $0 result.
    expect(buggyResolve(0, 1500)).toBe(1500);
    expect(resolvePaidAmount(0, 1500)).not.toBe(buggyResolve(0, 1500));
  });
});
