import { describe, it, expect } from "vitest";
import { PLANS, ALL_PLANS, planByTier } from "@/lib/plans";
import { entitlementsForTier } from "@/lib/entitlements-core";

// Regression tests for the 5-tier -> 3-tier public pricing cut: Basic and
// Connect are grandfathered (existing orgs keep working exactly as before —
// see TIER_LIMITS in entitlements-core.ts, untouched by this task) but must
// never be offered to a new signup or shown on public pricing again.
describe("public PLANS catalog", () => {
  it("has exactly 3 entries", () => {
    expect(PLANS).toHaveLength(3);
  });

  it("is exactly Lite, Growth and Pro — never a hidden tier", () => {
    expect(PLANS.map((p) => p.tier).sort()).toEqual(["GROWTH", "LITE", "PRO"]);
  });

  it("never includes a plan flagged hidden", () => {
    expect(PLANS.every((p) => !p.hidden)).toBe(true);
  });

  it("Basic and Connect are flagged hidden in the full catalog", () => {
    expect(ALL_PLANS.find((p) => p.tier === "BASIC")?.hidden).toBe(true);
    expect(ALL_PLANS.find((p) => p.tier === "CONNECT")?.hidden).toBe(true);
  });

  it("ALL_PLANS still has all 5 tiers, for grandfathered lookups (planByTier) and admin tooling", () => {
    expect(ALL_PLANS.map((p) => p.tier).sort()).toEqual(["BASIC", "CONNECT", "GROWTH", "LITE", "PRO"]);
  });

  it("planByTier resolves a hidden tier's name even though it's off the public list", () => {
    expect(planByTier("BASIC").name).toBe("Basic");
    expect(planByTier("CONNECT").name).toBe("Connect");
  });
});

// Confirms hiding Basic/Connect from PLANS changed nothing about what they
// actually DO — a grandfathered org's entitlements (table/station limits,
// branding, fee) must be byte-for-byte what they were before this task.
describe("hidden tiers' entitlements are unchanged", () => {
  it("BASIC: ordering, 25 tables, 2 stations, 14-day analytics, branding shown, no fee", () => {
    const ent = entitlementsForTier("BASIC");
    expect(ent.ordering).toBe(true);
    expect(ent.tableLimit).toBe(25);
    expect(ent.kdsStationLimit).toBe(2);
    expect(ent.analyticsWindowDays).toBe(14);
    expect(ent.showTillzBranding).toBe(true);
    expect(ent.appFeeBps).toBe(0);
    expect(ent.requiresSquare).toBe(false);
  });

  it("CONNECT: unlimited tables, no kitchen stations, Square required, 150bps fee", () => {
    const ent = entitlementsForTier("CONNECT");
    expect(ent.ordering).toBe(true);
    expect(ent.tableLimit).toBeNull();
    expect(ent.kdsStationLimit).toBe(0);
    expect(ent.venueLimit).toBeNull();
    expect(ent.analyticsWindowDays).toBe(14);
    expect(ent.appFeeBps).toBe(150);
    expect(ent.requiresSquare).toBe(true);
  });
});
