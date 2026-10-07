import { describe, it, expect, vi, beforeEach } from "vitest";

// Separate file from actions.test.ts: this mocks startSubscriptionOrMock
// directly (to force the "real Checkout Session" branch without touching
// Stripe), which would otherwise interfere with actions.test.ts's own tests
// of the gate logic sitting in front of it.
const { getAuthz } = vi.hoisted(() => ({ getAuthz: vi.fn() }));
const { startSubscriptionOrMock } = vi.hoisted(() => ({ startSubscriptionOrMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthz }));
vi.mock("@/lib/billing/checkout-or-mock", () => ({ startSubscriptionOrMock }));
vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prisma-mock");
  return { prisma: createPrismaMock() };
});
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { subscribe } from "./actions";
import { prisma as prismaImport } from "@/lib/prisma";
const prisma = prismaImport as any;

describe("subscribe() — real Checkout Session branch", () => {
  beforeEach(() => {
    getAuthz.mockReset();
    startSubscriptionOrMock.mockReset();
    vi.mocked(prisma.organization.update).mockReset();
    vi.stubEnv("BILLING_ENABLED", "true");
    getAuthz.mockResolvedValue({
      can: () => true,
      membership: {
        organization: { id: "org-1", plan: "LITE", hasUsedTrial: false, restaurants: [{ id: "rest-1" }] },
      },
      user: { id: "user-1", email: "o@example.com" },
    });
  });

  it("returns the redirect URL and never writes the mock shape when a real Checkout Session exists", async () => {
    startSubscriptionOrMock.mockResolvedValue({ redirectUrl: "https://stripe.test/checkout/cs_1" });

    const res = await subscribe("GROWTH" as any);

    expect(res).toEqual({ ok: true, redirectUrl: "https://stripe.test/checkout/cs_1" });
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it("writes the mock shape and returns no redirectUrl when the provider falls back to mock data", async () => {
    startSubscriptionOrMock.mockResolvedValue({ mockData: { plan: "GROWTH", planStatus: "active" } });
    vi.mocked(prisma.organization.update).mockResolvedValue({});

    const res = await subscribe("GROWTH" as any);

    expect(res).toEqual({ ok: true });
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { plan: "GROWTH", planStatus: "active" },
    });
  });
});
