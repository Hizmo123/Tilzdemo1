import { describe, it, expect } from "vitest";
import { mockSubscriptionData, getTrialStatus, TRIAL_DAYS } from "@/lib/plan-subscription";

// Regression test for Phase 4.5: re-subscribing (billing page's plan
// switcher, and the onboarding wizard's plan step) wrote plan/planStatus/
// subscribedAt but never cleared subscriptionLapsedAt — an org that had
// lapsed and then re-subscribed stayed flagged as lapsed forever, since
// nothing else in the codebase ever clears that field.
describe("mockSubscriptionData", () => {
  it("clears subscriptionLapsedAt when (re-)subscribing", () => {
    const data = mockSubscriptionData("GROWTH", false);
    expect(data.subscriptionLapsedAt).toBeNull();
  });

  it("still sets the rest of the active-subscription shape", () => {
    const data = mockSubscriptionData("PRO", false);
    expect(data.plan).toBe("PRO");
    expect(data.planStatus).toBe("active");
    expect(data.subscribedAt).toBeInstanceOf(Date);
  });
});

// Free trial (task: real feature, not just marketing copy).
describe("mockSubscriptionData trial behavior", () => {
  it("starts a TRIAL_DAYS-long trial and sets hasUsedTrial on a first-ever paid-tier switch", () => {
    const before = Date.now();
    const data = mockSubscriptionData("BASIC", false);
    expect(data.hasUsedTrial).toBe(true);
    expect(data.trialEndsAt).toBeInstanceOf(Date);
    const daysOut = ((data.trialEndsAt as Date).getTime() - before) / (24 * 60 * 60 * 1000);
    expect(daysOut).toBeGreaterThan(TRIAL_DAYS - 0.01);
    expect(daysOut).toBeLessThanOrEqual(TRIAL_DAYS + 0.01);
  });

  it("does NOT start a new trial (or re-set hasUsedTrial) once the org has already used one", () => {
    const data = mockSubscriptionData("GROWTH", true);
    expect(data.hasUsedTrial).toBeUndefined(); // omitted, not re-written
    expect(data.trialEndsAt).toBeUndefined(); // omitted — leaves the DB value as-is
  });

  it("never sets a trial for LITE or CONNECT, even if hasUsedTrial is false", () => {
    expect(mockSubscriptionData("LITE", false).trialEndsAt).toBeNull();
    expect(mockSubscriptionData("CONNECT", false).trialEndsAt).toBeNull();
    expect(mockSubscriptionData("LITE", false).hasUsedTrial).toBeUndefined();
    expect(mockSubscriptionData("CONNECT", false).hasUsedTrial).toBeUndefined();
  });
});

describe("getTrialStatus", () => {
  it("reports an active trial with days remaining, for a trialable tier with a future trialEndsAt", () => {
    const endsAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const status = getTrialStatus({ plan: "BASIC", trialEndsAt: endsAt });
    expect(status.inTrial).toBe(true);
    if (status.inTrial) {
      expect(status.daysRemaining).toBeGreaterThanOrEqual(4);
      expect(status.daysRemaining).toBeLessThanOrEqual(5);
    }
  });

  it("reports no trial once trialEndsAt has passed — the mock model just keeps the org active, no gate changes", () => {
    const endsAt = new Date(Date.now() - 1000);
    expect(getTrialStatus({ plan: "GROWTH", trialEndsAt: endsAt }).inTrial).toBe(false);
  });

  it("reports no trial for LITE or CONNECT even with a (stale) trialEndsAt set", () => {
    const endsAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    expect(getTrialStatus({ plan: "LITE", trialEndsAt: endsAt }).inTrial).toBe(false);
    expect(getTrialStatus({ plan: "CONNECT", trialEndsAt: endsAt }).inTrial).toBe(false);
  });

  it("reports no trial when trialEndsAt is null", () => {
    expect(getTrialStatus({ plan: "PRO", trialEndsAt: null }).inTrial).toBe(false);
  });
});
