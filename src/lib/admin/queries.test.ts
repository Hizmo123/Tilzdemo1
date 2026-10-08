import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prisma-mock");
  return { prisma: createPrismaMock() };
});

import { getPlatformOverview } from "./queries";
import { prisma as prismaImport } from "@/lib/prisma";
const prisma = prismaImport as any;

type OrgFixture = {
  id: string;
  plan: "LITE" | "BASIC" | "GROWTH" | "PRO" | "CONNECT";
  subscriptionLapsedAt?: Date | null;
  stripeStatus?: string | null;
  restaurantCount?: number;
};

function org(f: OrgFixture) {
  return {
    id: f.id,
    plan: f.plan,
    subscriptionLapsedAt: f.subscriptionLapsedAt ?? null,
    stripeStatus: f.stripeStatus ?? null,
    createdAt: new Date(),
    _count: { restaurants: f.restaurantCount ?? 1 },
  };
}

function setOrgs(orgs: ReturnType<typeof org>[]) {
  vi.mocked(prisma.organization.findMany).mockResolvedValue(orgs);
}

beforeEach(() => {
  vi.mocked(prisma.organization.findMany).mockReset();
  vi.mocked(prisma.payment.aggregate).mockReset().mockResolvedValue({
    _sum: { appFeeCents: null },
    _count: { appFeeCents: 0 },
  });
  vi.mocked(prisma.restaurant.count).mockReset().mockResolvedValue(0);
  vi.mocked(prisma.restaurant.findMany).mockReset().mockResolvedValue([]);
  vi.mocked(prisma.order.findMany).mockReset().mockResolvedValue([]);
});

describe("getPlatformOverview — MRR", () => {
  // Regression test for the actual bug report: LITE is a $7.99/mo paid
  // subscription (see src/lib/plans.ts), not a free tier — an org actually
  // paying for it must count in MRR, not get lumped in with "free".
  it("a LITE org with an ACTIVE Stripe subscription counts in MRR at its real price", async () => {
    setOrgs([org({ id: "o1", plan: "LITE", stripeStatus: "active" })]);

    const overview = await getPlatformOverview();

    expect(overview.mrrCents).toBe(799);
    expect(overview.mrrByTier.find((t) => t.tier === "LITE")).toEqual({
      tier: "LITE",
      orgs: 1,
      mrrCents: 799,
    });
    expect(overview.subscriptions.active).toBe(1);
  });

  // The other half of the same bug: a paid-tier org with NO real Stripe
  // subscription (pre-Stripe mock assignment, admin test org, ...) must
  // never be counted as paying just because its `plan` column says GROWTH.
  it("a GROWTH org with no real Stripe subscription is excluded from MRR entirely", async () => {
    setOrgs([org({ id: "o1", plan: "GROWTH", stripeStatus: null })]);

    const overview = await getPlatformOverview();

    expect(overview.mrrCents).toBe(0);
    expect(overview.mrrByTier.find((t) => t.tier === "GROWTH")).toEqual({
      tier: "GROWTH",
      orgs: 0,
      mrrCents: 0,
    });
    expect(overview.subscriptions.noRealSubscription).toBe(1);
    expect(overview.subscriptions.active).toBe(0);
  });

  it("a trialing org contributes $0 to MRR but counts in the trial pipeline", async () => {
    setOrgs([org({ id: "o1", plan: "GROWTH", stripeStatus: "trialing" })]);

    const overview = await getPlatformOverview();

    expect(overview.mrrCents).toBe(0);
    expect(overview.trialPipelineCents).toBe(7999);
    expect(overview.subscriptions.trialing).toBe(1);
  });

  it("a past_due org is excluded from MRR and counted separately", async () => {
    setOrgs([org({ id: "o1", plan: "PRO", stripeStatus: "past_due" })]);

    const overview = await getPlatformOverview();

    expect(overview.mrrCents).toBe(0);
    expect(overview.subscriptions.pastDue).toBe(1);
  });

  it.each(["canceled", "unpaid", "incomplete_expired"])(
    "a %s org is excluded from MRR and counted as canceled",
    async (status) => {
      setOrgs([org({ id: "o1", plan: "PRO", stripeStatus: status })]);

      const overview = await getPlatformOverview();

      expect(overview.mrrCents).toBe(0);
      expect(overview.subscriptions.canceled).toBe(1);
    },
  );

  it("a PRO org past its 3 included venues includes the extra-venue add-on in MRR", async () => {
    setOrgs([org({ id: "o1", plan: "PRO", stripeStatus: "active", restaurantCount: 5 })]);

    const overview = await getPlatformOverview();

    // 14999 (Pro) + 2 extra venues * 4999 = 24997
    expect(overview.mrrCents).toBe(14999 + 2 * 4999);
    expect(overview.mrrByTier.find((t) => t.tier === "PRO")?.mrrCents).toBe(14999 + 2 * 4999);
  });

  it("a PRO org within its 3 included venues adds no extra-venue surcharge", async () => {
    setOrgs([org({ id: "o1", plan: "PRO", stripeStatus: "active", restaurantCount: 3 })]);

    const overview = await getPlatformOverview();

    expect(overview.mrrCents).toBe(14999);
  });

  it("the extra-venue add-on folds into the trial pipeline too, for a trialing PRO org", async () => {
    setOrgs([org({ id: "o1", plan: "PRO", stripeStatus: "trialing", restaurantCount: 4 })]);

    const overview = await getPlatformOverview();

    expect(overview.trialPipelineCents).toBe(14999 + 4999);
    expect(overview.mrrCents).toBe(0);
  });

  it("CONNECT orgs are excluded from MRR and mrrByTier, counted under subscriptions.connect", async () => {
    setOrgs([org({ id: "o1", plan: "CONNECT", stripeStatus: null })]);

    const overview = await getPlatformOverview();

    expect(overview.mrrCents).toBe(0);
    expect(overview.mrrByTier.find((t) => t.tier === "CONNECT")).toBeUndefined();
    expect(overview.subscriptions.connect).toBe(1);
    expect(overview.subscriptions.noRealSubscription).toBe(0);
  });

  it("mrrByTier never includes the grandfathered BASIC tier", async () => {
    setOrgs([org({ id: "o1", plan: "BASIC", stripeStatus: null })]);

    const overview = await getPlatformOverview();

    expect(overview.mrrByTier.find((t) => t.tier === "BASIC")).toBeUndefined();
    expect(overview.mrrByTier.map((t) => t.tier).sort()).toEqual(["GROWTH", "LITE", "PRO"]);
  });

  it("mixes multiple orgs correctly across tiers and statuses", async () => {
    setOrgs([
      org({ id: "o1", plan: "LITE", stripeStatus: "active" }),
      org({ id: "o2", plan: "GROWTH", stripeStatus: "active" }),
      org({ id: "o3", plan: "GROWTH", stripeStatus: "active" }),
      org({ id: "o4", plan: "PRO", stripeStatus: "trialing" }),
      org({ id: "o5", plan: "CONNECT", stripeStatus: null }),
      org({ id: "o6", plan: "LITE", stripeStatus: null }),
    ]);

    const overview = await getPlatformOverview();

    expect(overview.mrrCents).toBe(799 + 7999 * 2);
    expect(overview.trialPipelineCents).toBe(14999);
    expect(overview.subscriptions).toEqual({
      active: 3,
      trialing: 1,
      pastDue: 0,
      canceled: 0,
      connect: 1,
      noRealSubscription: 1,
    });
  });
});

describe("getPlatformOverview — Connect fee revenue", () => {
  it("is null when no Payment has a recorded app fee", async () => {
    setOrgs([]);
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({
      _sum: { appFeeCents: null },
      _count: { appFeeCents: 0 },
    });

    const overview = await getPlatformOverview();

    expect(overview.connectFeeRevenueCents).toBeNull();
  });

  it("sums appFeeCents across successful payments when the data exists", async () => {
    setOrgs([]);
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({
      _sum: { appFeeCents: 1234 },
      _count: { appFeeCents: 5 },
    });

    const overview = await getPlatformOverview();

    expect(overview.connectFeeRevenueCents).toBe(1234);
    expect(prisma.payment.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "SUCCEEDED", appFeeCents: { not: null } }),
      }),
    );
  });

  it("is 0, not null, when the only recorded fee happens to total zero", async () => {
    setOrgs([]);
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({
      _sum: { appFeeCents: 0 },
      _count: { appFeeCents: 1 },
    });

    const overview = await getPlatformOverview();

    expect(overview.connectFeeRevenueCents).toBe(0);
  });
});
