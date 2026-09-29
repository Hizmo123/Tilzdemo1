import { describe, it, expect } from "vitest";
import { entitlementsForTier, CONNECT_APP_FEE_BPS, connectFeePercentLabel } from "@/lib/entitlements-core";
import { PLANS, CONNECT_FEE_BLURB, getFullPlanSpec } from "@/lib/plans";

// Regression test for the copy/code drift this task fixed: the Connect
// commission was changed to 1.5% by the owner, but TIER_LIMITS.CONNECT.
// appFeeBps was still 200 (2%) — the charge path and the pricing page could
// (and did) disagree about what rate the platform actually charges.
// CONNECT_APP_FEE_BPS in entitlements-core.ts is now the one place this
// number is defined; everything else must read from it, directly or via
// connectFeePercentLabel()/CONNECT_FEE_BLURB — never re-type the percentage
// as its own literal.
describe("Connect commission has one source of truth", () => {
  it("the constant is 1.5% (150 bps), matching the owner's actual rate", () => {
    expect(CONNECT_APP_FEE_BPS).toBe(150);
  });

  it("the charge-path entitlement (what square/pay.ts's appFeeBps input is built from) equals the constant", () => {
    const ent = entitlementsForTier("CONNECT");
    expect(ent.appFeeBps).toBe(CONNECT_APP_FEE_BPS);
  });

  it("every OTHER tier's appFeeBps stays 0 — the fee is exclusive to Connect", () => {
    for (const tier of ["LITE", "BASIC", "GROWTH", "PRO"] as const) {
      expect(entitlementsForTier(tier).appFeeBps).toBe(0);
    }
  });

  it("connectFeePercentLabel() renders the constant as a percentage, not a separate hardcoded figure", () => {
    expect(connectFeePercentLabel()).toBe("1.5%");
  });

  it("CONNECT_FEE_BLURB states the base explicitly — subtotal, excluding tips — not the ambiguous 'per order'", () => {
    expect(CONNECT_FEE_BLURB).toBe("1.5% of the order subtotal, excluding tips");
  });

  it("the pricing catalog's Connect cadence copy is derived from the same blurb, and states 1.5% not 2%", () => {
    const connectPlan = PLANS.find((p) => p.tier === "CONNECT")!;
    expect(connectPlan.cadence).toBe(`free + ${CONNECT_FEE_BLURB}`);
    expect(connectPlan.cadence).toContain("1.5% of the order subtotal, excluding tips");
    expect(connectPlan.cadence).not.toContain("2%");
  });

  it("the billing page's full-spec 'Per-order fee' line also states the base explicitly, from the same blurb", () => {
    const lines = getFullPlanSpec("CONNECT");
    const feeLine = lines.find((l) => l.label === "Per-order fee");
    expect(feeLine?.value).toContain("1.5% of the order subtotal, excluding tips");
    expect(feeLine?.value).not.toContain("2%");
  });
});
