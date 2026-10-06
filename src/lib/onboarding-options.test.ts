import { describe, it, expect } from "vitest";
import {
  defaultOnboardingAnswers,
  applyPlanChoice,
  planRequiresSquare,
  planAllowsOrdering,
  PLAN_TIER_VALUES,
} from "@/lib/onboarding-options";

// Regression test for the default-plan bug the 3-tier pricing cut would
// otherwise introduce: the wizard used to default to BASIC (now hidden from
// every picker) on the theory that it was "the cheapest tier that keeps the
// experience step's answers coherent". Once Basic left the public list, a
// brand-new wizard session would start on a tier no card in PlanPicker
// represents — no radio would show selected. GROWTH is the fix.
describe("defaultOnboardingAnswers", () => {
  it("defaults to GROWTH, not the now-hidden BASIC or the no-ordering LITE", () => {
    expect(defaultOnboardingAnswers().plan).toBe("GROWTH");
  });
});

// PLAN_TIER_VALUES is the full Prisma enum tuple (zod/iteration use), not a
// "what's offered" list — must stay all 5 even though public pricing is 3.
describe("PLAN_TIER_VALUES", () => {
  it("still has all 5 tiers", () => {
    expect([...PLAN_TIER_VALUES].sort()).toEqual(["BASIC", "CONNECT", "GROWTH", "LITE", "PRO"]);
  });
});

// Regression test for "Connect must stay reachable": the marketing pricing
// page's "pay as you sell" strip and the onboarding plan step's own Connect
// CTA both ultimately call this function (choosePlan in onboarding-wizard.tsx
// does too) — asserting its behaviour here covers every caller at once.
describe("applyPlanChoice — choosing the pay-as-you-sell strip", () => {
  it("choosing CONNECT sets tier CONNECT and requires Square", () => {
    const base = defaultOnboardingAnswers();
    const next = applyPlanChoice(base, "CONNECT");

    expect(next.plan).toBe("CONNECT");
    expect(planRequiresSquare(next.plan)).toBe(true);
  });

  it("choosing CONNECT forces both ordering toggles on and locks the payment path to square, regardless of prior answers", () => {
    const base = { ...defaultOnboardingAnswers(), customerOrdering: false, customerPayment: false, paymentPath: "tillz" as const };
    const next = applyPlanChoice(base, "CONNECT");

    expect(next.customerOrdering).toBe(true);
    expect(next.customerPayment).toBe(true);
    expect(next.paymentPath).toBe("square");
  });

  it("choosing CONNECT from the menu-only LITE experience restores order_and_pay, not digital_menu", () => {
    const base = { ...defaultOnboardingAnswers(), plan: "LITE" as const, experienceMode: "digital_menu" as const };
    const next = applyPlanChoice(base, "CONNECT");

    expect(next.experienceMode).toBe("order_and_pay");
  });

  it("a public tier (GROWTH) never requires Square", () => {
    const next = applyPlanChoice(defaultOnboardingAnswers(), "GROWTH");
    expect(planRequiresSquare(next.plan)).toBe(false);
  });

  it("LITE fixes the experience to digital_menu (no ordering)", () => {
    const next = applyPlanChoice(defaultOnboardingAnswers(), "LITE");
    expect(planAllowsOrdering(next.plan)).toBe(false);
    expect(next.experienceMode).toBe("digital_menu");
  });
});
