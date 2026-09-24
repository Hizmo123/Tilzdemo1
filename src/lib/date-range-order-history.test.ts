import { describe, it, expect } from "vitest";
import {
  parseRangeParams,
  clampRangeToWindow,
  disabledPresets,
  earliestAllowedDateStr,
  resolveRange,
} from "@/lib/date-range";

// Verifies the Order History feature's entitlement gating against the real
// analyticsWindowDays values for BASIC (14), GROWTH (null) and PRO (null) —
// the same values entitlements-core.ts defines, reused here rather than
// invented, exactly as Analytics already applies them.
const TZ = "Australia/Sydney";
const BASIC_WINDOW = 14;
const GROWTH_WINDOW: number | null = null;
const PRO_WINDOW: number | null = null;

describe("Order History defaults to Last 30 days (not Analytics' 7d default)", () => {
  it("no query params at all resolves to the 30d preset", () => {
    const { preset } = parseRangeParams({}, TZ, "30d");
    expect(preset).toBe("30d");
  });
});

describe("BASIC (analyticsWindowDays = 14)", () => {
  it("Last 7 days and Last 30 days requests are not both clampable — 30d IS clamped, 7d is not", () => {
    const req7 = resolveRange("7d", TZ);
    expect(clampRangeToWindow(req7, BASIC_WINDOW, TZ).clamped).toBe(false);

    const req30 = resolveRange("30d", TZ);
    const { resolved, clamped } = clampRangeToWindow(req30, BASIC_WINDOW, TZ);
    expect(clamped).toBe(true);
    // Clamped to exactly the 14-day window, not silently left at 30.
    const spanDays = Math.round((resolved.to.getTime() - resolved.from.getTime()) / 86_400_000);
    expect(spanDays).toBe(14);
  });

  it("greys out every preset wider than 14 days, leaving Today/7d selectable", () => {
    const disabled = disabledPresets(BASIC_WINDOW, TZ);
    expect(disabled).toContain("30d");
    expect(disabled).toContain("90d");
    expect(disabled).not.toContain("today");
    expect(disabled).not.toContain("7d");
  });

  it("floors the custom date picker at 14 days back", () => {
    const min = earliestAllowedDateStr(BASIC_WINDOW, TZ);
    expect(min).not.toBeNull();
    const daysBack = Math.round((Date.now() - new Date(min!).getTime()) / 86_400_000);
    expect(daysBack).toBeGreaterThanOrEqual(13); // 14-day window incl. today
    expect(daysBack).toBeLessThanOrEqual(15);
  });
});

describe("GROWTH and PRO (analyticsWindowDays = null — unrestricted)", () => {
  for (const [label, windowDays] of [
    ["GROWTH", GROWTH_WINDOW],
    ["PRO", PRO_WINDOW],
  ] as const) {
    it(`${label}: Last 90 days is never clamped`, () => {
      const req90 = resolveRange("90d", TZ);
      expect(clampRangeToWindow(req90, windowDays, TZ).clamped).toBe(false);
    });

    it(`${label}: no preset is disabled`, () => {
      expect(disabledPresets(windowDays, TZ)).toEqual([]);
    });

    it(`${label}: custom date picker has no floor`, () => {
      expect(earliestAllowedDateStr(windowDays, TZ)).toBeNull();
    });
  }
});
