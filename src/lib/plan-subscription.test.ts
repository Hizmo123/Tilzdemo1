import { describe, it, expect } from "vitest";
import { mockSubscriptionData } from "@/lib/plan-subscription";

// Regression test for Phase 4.5: re-subscribing (billing page's plan
// switcher, and the onboarding wizard's plan step) wrote plan/planStatus/
// subscribedAt but never cleared subscriptionLapsedAt — an org that had
// lapsed and then re-subscribed stayed flagged as lapsed forever, since
// nothing else in the codebase ever clears that field.
describe("mockSubscriptionData", () => {
  it("clears subscriptionLapsedAt when (re-)subscribing", () => {
    const data = mockSubscriptionData("GROWTH");
    expect(data.subscriptionLapsedAt).toBeNull();
  });

  it("still sets the rest of the active-subscription shape", () => {
    const data = mockSubscriptionData("PRO");
    expect(data.plan).toBe("PRO");
    expect(data.planStatus).toBe("active");
    expect(data.subscribedAt).toBeInstanceOf(Date);
  });
});
