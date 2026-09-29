import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression tests for Phase 2 of the Connect-commission task: appFeeCents
// used Math.floor (systematically under-collecting a fraction of a cent on
// every single charge) and had no explicit floor/never-exceed-payment
// guard. computeAppFeeCents (lib/square/pay.ts) now rounds to the nearest
// cent and is clamped to [0, 90% of the total charged].
import { computeAppFeeCents } from "./pay";

const BPS_1_5_PERCENT = 150;

describe("computeAppFeeCents — exact cents at 1.5%", () => {
  // [goodsCents, expectedFeeCents] — goodsCents === totalChargeCents (no
  // tip/surcharge) in each of these, so the 90% cap never binds and the
  // only thing under test is the rounding.
  const cases: [number, number][] = [
    [300, 5], // $3.00 -> 4.5c -> rounds to 5c (Math.floor would give 4c)
    [50, 1], // $0.50 -> 0.75c -> rounds to 1c (Math.floor would give 0 — a real fee silently dropped)
    [999, 15], // $9.99 -> 14.985c -> rounds to 15c
    [10000, 150], // $100.00 -> exactly 150c, no rounding involved
    [123456, 1852], // $1,234.56 -> 1851.84c -> rounds to 1852c
  ];

  it.each(cases)("goodsCents=%i -> appFeeCents=%i", (goodsCents, expected) => {
    expect(computeAppFeeCents(goodsCents, BPS_1_5_PERCENT, goodsCents)).toBe(expected);
  });

  it("a tip-only charge (goodsCents 0, tip carries the whole payment) is fee-free, not a rounding artefact of a tiny nonzero fee", () => {
    const goodsCents = 0;
    const tipCents = 500;
    const totalChargeCents = goodsCents + tipCents;
    expect(computeAppFeeCents(goodsCents, BPS_1_5_PERCENT, totalChargeCents)).toBe(0);
  });

  it("the fee is charged on goods only — adding tip/surcharge to totalChargeCents never changes it (until the 90% cap, tested below)", () => {
    const goodsCents = 300;
    const withoutExtras = computeAppFeeCents(goodsCents, BPS_1_5_PERCENT, goodsCents);
    const withTipAndSurcharge = computeAppFeeCents(goodsCents, BPS_1_5_PERCENT, goodsCents + 200 + 50);
    expect(withTipAndSurcharge).toBe(withoutExtras);
  });

  it("never negative, even with a (should-never-happen) negative bps", () => {
    expect(computeAppFeeCents(1000, -150, 1000)).toBe(0);
  });

  it("never exceeds the payment amount — clamped at 90% of totalChargeCents, matching Square's own hard limit", () => {
    // An artificially huge bps (150%) to force the cap to actually bind:
    // 1000c * 15000bps/10000 = 1500c uncapped, well past both the payment
    // amount and Square's 90% limit.
    const goodsCents = 1000;
    const totalChargeCents = 1000;
    const fee = computeAppFeeCents(goodsCents, 15000, totalChargeCents);
    expect(fee).toBe(Math.floor(totalChargeCents * 0.9));
    expect(fee).toBeLessThan(totalChargeCents);
  });
});

describe("computeAppFeeCents — split-bill drift", () => {
  it("two equal-split $25 payments on a $50 bill: each payment's own fee, summed, is within 1c per payment of 1.5% of the bill total", () => {
    const perPaymentFee = computeAppFeeCents(2500, BPS_1_5_PERCENT, 2500);
    const summed = perPaymentFee * 2;
    const wholeBillFee = computeAppFeeCents(5000, BPS_1_5_PERCENT, 5000);
    const drift = Math.abs(summed - wholeBillFee);
    // Worst case observed here: 1c total drift across 2 payments (38c+38c=76c
    // vs 75c computed on the full $50 at once) — well within the 1c-per-
    // payment bound (2c) the split-payment model allows for.
    expect(drift).toBeLessThanOrEqual(2 * 1);
    expect(perPaymentFee).toBe(38);
    expect(wholeBillFee).toBe(75);
    expect(drift).toBe(1);
  });

  it("four equal-split payments on a $9.99 bill stay within a 4c total drift bound (1c x 4 payments)", () => {
    const share = Math.round(999 / 4); // 250c each, last one absorbs the remainder in real code — approximated evenly here for the bound check
    const perPaymentFee = computeAppFeeCents(share, BPS_1_5_PERCENT, share);
    const summed = perPaymentFee * 4;
    const wholeBillFee = computeAppFeeCents(999, BPS_1_5_PERCENT, 999);
    expect(Math.abs(summed - wholeBillFee)).toBeLessThanOrEqual(4 * 1);
  });
});

// The fee is computed inside chargeBillViaSquare PER PAYMENT (one call per
// charge, using that charge's own goodsCents/tipCents/surchargeCents) — not
// once against the whole bill and divided — confirmed structurally: bills.ts
// calls chargeBillViaSquare separately for every payment (full, split-equal,
// split-items, custom-amount), each passing only that payment's own amount.
// The tests above exercise the same computeAppFeeCents this call always
// resolves to, which is what makes "per payment" true regardless of how the
// bill was split.

const ordersCreate = vi.fn();
const paymentsCreate = vi.fn();
vi.mock("@/lib/square/client", () => ({
  squareClientFor: vi.fn(async () => ({
    orders: { create: ordersCreate },
    payments: { create: paymentsCreate },
  })),
}));

import { chargeBillViaSquare } from "./pay";

describe("chargeBillViaSquare omits appFeeMoney entirely when the fee is 0", () => {
  beforeEach(() => {
    ordersCreate.mockReset();
    paymentsCreate.mockReset();
  });

  const connection = { locationId: "loc-1" } as unknown as Parameters<typeof chargeBillViaSquare>[0]["connection"];
  const baseInput = {
    connection,
    bill: { id: "bill-1", tableLabel: "5" },
    lineItems: [{ name: "Bill payment (full)", quantity: 1, unitPriceCents: 0 }],
    tipCents: 500,
    surchargeCents: 0,
    currency: "AUD",
    sourceId: "src-1",
    idempotencyKey: "idem-1",
  };

  it("goodsCents: 0 (a tip-only charge) — no appFeeMoney key is sent to Square at all", async () => {
    ordersCreate.mockResolvedValue({ order: { id: "order-1", totalMoney: { amount: BigInt(0) } } });
    paymentsCreate.mockResolvedValue({ payment: { id: "payment-1", status: "COMPLETED" } });

    await chargeBillViaSquare({ ...baseInput, goodsCents: 0, appFeeBps: 150 });

    expect(paymentsCreate).toHaveBeenCalledTimes(1);
    const call = paymentsCreate.mock.calls[0][0];
    expect("appFeeMoney" in call).toBe(false);
    expect(call.tipMoney).toEqual({ amount: BigInt(500), currency: "AUD" });
  });

  it("a real goods charge on a Connect org DOES send appFeeMoney, rounded to the nearest cent", async () => {
    ordersCreate.mockResolvedValue({ order: { id: "order-2", totalMoney: { amount: BigInt(300) } } });
    paymentsCreate.mockResolvedValue({ payment: { id: "payment-2", status: "COMPLETED" } });

    await chargeBillViaSquare({
      ...baseInput,
      lineItems: [{ name: "Bill payment (full)", quantity: 1, unitPriceCents: 300 }],
      goodsCents: 300,
      tipCents: 0,
      appFeeBps: 150,
    });

    const call = paymentsCreate.mock.calls[0][0];
    expect(call.appFeeMoney).toEqual({ amount: BigInt(5), currency: "AUD" });
  });

  it("a non-Connect org (appFeeBps: 0) never sends appFeeMoney", async () => {
    ordersCreate.mockResolvedValue({ order: { id: "order-3", totalMoney: { amount: BigInt(300) } } });
    paymentsCreate.mockResolvedValue({ payment: { id: "payment-3", status: "COMPLETED" } });

    await chargeBillViaSquare({
      ...baseInput,
      lineItems: [{ name: "Bill payment (full)", quantity: 1, unitPriceCents: 300 }],
      goodsCents: 300,
      tipCents: 0,
      appFeeBps: 0,
    });

    const call = paymentsCreate.mock.calls[0][0];
    expect("appFeeMoney" in call).toBe(false);
  });
});
