import { describe, it, expect, vi, beforeEach } from "vitest";

const { getBillingProvider } = vi.hoisted(() => ({ getBillingProvider: vi.fn() }));
vi.mock("./index", () => ({ getBillingProvider }));

import { startSubscriptionOrMock } from "./checkout-or-mock";

describe("startSubscriptionOrMock", () => {
  const createCheckoutSession = vi.fn();

  beforeEach(() => {
    createCheckoutSession.mockReset();
    getBillingProvider.mockReturnValue({ createCheckoutSession });
  });

  it("returns a redirectUrl when the provider has a real Checkout Session", async () => {
    createCheckoutSession.mockResolvedValue({ configured: true, url: "https://stripe.test/checkout/1" });

    const res = await startSubscriptionOrMock({
      organizationId: "org-1",
      tier: "GROWTH" as any,
      hasUsedTrial: false,
      successUrl: "https://app.test/billing",
      cancelUrl: "https://app.test/billing",
    });

    expect(res).toEqual({ redirectUrl: "https://stripe.test/checkout/1" });
  });

  it("falls back to the mock instant-activate shape when the provider isn't configured", async () => {
    createCheckoutSession.mockResolvedValue({ configured: false, error: "not configured" });

    const res = await startSubscriptionOrMock({
      organizationId: "org-1",
      tier: "GROWTH" as any,
      hasUsedTrial: false,
      successUrl: "https://app.test/billing",
      cancelUrl: "https://app.test/billing",
    });

    expect("mockData" in res).toBe(true);
    if ("mockData" in res) {
      expect(res.mockData.plan).toBe("GROWTH");
      expect(res.mockData.planStatus).toBe("active");
    }
  });
});
