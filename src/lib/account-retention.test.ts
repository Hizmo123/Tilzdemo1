import { describe, it, expect } from "vitest";
import { ACCOUNT_RETENTION_YEARS, purgeEligibleFrom } from "@/lib/account-retention";

describe("purgeEligibleFrom", () => {
  it("is exactly ACCOUNT_RETENTION_YEARS (5) calendar years later", () => {
    expect(ACCOUNT_RETENTION_YEARS).toBe(5);
    const executed = new Date("2026-09-28T03:04:05.000Z");
    expect(purgeEligibleFrom(executed).toISOString()).toBe("2031-09-28T03:04:05.000Z");
  });

  it("does not mutate the date it was given", () => {
    const executed = new Date("2026-01-15T00:00:00.000Z");
    purgeEligibleFrom(executed);
    expect(executed.toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });

  it("never lands EARLIER than 5 years for a leap-day close (retains slightly longer, not shorter)", () => {
    const executed = new Date("2028-02-29T12:00:00.000Z");
    const eligible = purgeEligibleFrom(executed);
    // 2033 has no Feb 29 — JS rolls to Mar 1, which is >= a true 5 years.
    expect(eligible.getTime()).toBeGreaterThanOrEqual(new Date("2033-02-28T12:00:00.000Z").getTime());
    expect(eligible.toISOString()).toBe("2033-03-01T12:00:00.000Z");
  });
});
