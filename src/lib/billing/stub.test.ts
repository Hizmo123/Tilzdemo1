import { describe, it, expect, afterEach, vi } from "vitest";
import { StubBillingProvider } from "./stub";

afterEach(() => {
  vi.unstubAllEnvs();
});

// No Stripe SDK, no network calls — every method must come back
// configured:false whenever STRIPE_SECRET_KEY is unset (every environment
// today), so callers (subscribe(), the Billing page, the webhook route) have
// one consistent "not configured" shape to fall back on.
describe("StubBillingProvider", () => {
  const provider = new StubBillingProvider();

  it("createCheckoutSession reports not configured", async () => {
    const result = await provider.createCheckoutSession({
      organizationId: "org-1",
      tier: "GROWTH" as any,
      successUrl: "/dashboard/billing",
      cancelUrl: "/dashboard/billing",
    });
    expect(result.configured).toBe(false);
  });

  it("createPortalSession reports not configured", async () => {
    const result = await provider.createPortalSession({
      organizationId: "org-1",
      returnUrl: "/dashboard/billing",
    });
    expect(result.configured).toBe(false);
  });

  it("handleWebhookEvent reports not configured", async () => {
    const result = await provider.handleWebhookEvent({ payload: "{}", signature: "sig" });
    expect(result.configured).toBe(false);
  });

  it("still reports not configured even with BILLING_ENABLED on — that flag only opens self-assignment, not Stripe itself", async () => {
    vi.stubEnv("BILLING_ENABLED", "true");
    const result = await provider.createCheckoutSession({
      organizationId: "org-1",
      tier: "LITE" as any,
      successUrl: "/dashboard/billing",
      cancelUrl: "/dashboard/billing",
    });
    expect(result.configured).toBe(false);
  });
});
