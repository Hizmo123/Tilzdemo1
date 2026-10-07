import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { getStripeClient } = vi.hoisted(() => ({ getStripeClient: vi.fn() }));
vi.mock("./stripe-client", () => ({ getStripeClient }));

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prisma-mock");
  return { prisma: createPrismaMock() };
});
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/log", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { StripeBillingProvider } from "./stripe-provider";
import { StripeSignatureError } from "./provider";
import { prisma as prismaImport } from "@/lib/prisma";
import { audit as auditImport } from "@/lib/audit";
const prisma = prismaImport as any;
const audit = auditImport as any;

function fakeStripe(overrides: Record<string, any> = {}) {
  return {
    customers: { create: vi.fn().mockResolvedValue({ id: "cus_new" }) },
    checkout: { sessions: { create: vi.fn().mockResolvedValue({ id: "cs_1", url: "https://stripe.test/checkout/cs_1" }) } },
    billingPortal: { sessions: { create: vi.fn().mockResolvedValue({ url: "https://stripe.test/portal/1" }) } },
    webhooks: { constructEvent: vi.fn() },
    subscriptions: { retrieve: vi.fn() },
    subscriptionItems: { create: vi.fn(), update: vi.fn(), del: vi.fn() },
    ...overrides,
  };
}

function subscriptionFixture(overrides: Record<string, any> = {}) {
  return {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    cancel_at_period_end: false,
    trial_end: null,
    metadata: { organizationId: "org-1" },
    items: {
      data: [
        {
          price: { id: "price_growth" },
          current_period_end: 1_700_000_000,
        },
      ],
    },
    ...overrides,
  };
}

const provider = new StripeBillingProvider();

beforeEach(() => {
  getStripeClient.mockReset();
  prisma.organization.findUnique.mockReset();
  prisma.organization.update.mockReset().mockResolvedValue({});
  prisma.membership.findFirst.mockReset();
  audit.mockReset();
  vi.stubEnv("STRIPE_PRICE_LITE", "price_lite");
  vi.stubEnv("STRIPE_PRICE_GROWTH", "price_growth");
  vi.stubEnv("STRIPE_PRICE_PRO", "price_pro");
  vi.stubEnv("STRIPE_PRICE_EXTRA_VENUE", "price_extra_venue");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createCheckoutSession", () => {
  it("not configured when there's no Stripe client", async () => {
    getStripeClient.mockReturnValue(null);
    const res = await provider.createCheckoutSession({
      organizationId: "org-1",
      tier: "GROWTH" as any,
      successUrl: "https://app.test/billing",
      cancelUrl: "https://app.test/billing",
    });
    expect(res.configured).toBe(false);
  });

  it("not configured when the tier has no Stripe price env var", async () => {
    vi.stubEnv("STRIPE_PRICE_GROWTH", "");
    getStripeClient.mockReturnValue(fakeStripe());
    const res = await provider.createCheckoutSession({
      organizationId: "org-1",
      tier: "GROWTH" as any,
      successUrl: "https://app.test/billing",
      cancelUrl: "https://app.test/billing",
    });
    expect(res.configured).toBe(false);
  });

  it("GROWTH/PRO get a 14-day trial on a first-ever subscription", async () => {
    const stripe = fakeStripe();
    getStripeClient.mockReturnValue(stripe);
    prisma.organization.findUnique.mockResolvedValue({ stripeCustomerId: "cus_1", hasUsedTrial: false });

    await provider.createCheckoutSession({
      organizationId: "org-1",
      tier: "GROWTH" as any,
      successUrl: "https://app.test/billing",
      cancelUrl: "https://app.test/billing",
    });

    const params = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(params.subscription_data.trial_period_days).toBe(14);
    expect(params.mode).toBe("subscription");
    expect(params.payment_method_collection).toBe("always");
  });

  it("LITE never gets a trial, even on a first-ever subscription", async () => {
    const stripe = fakeStripe();
    getStripeClient.mockReturnValue(stripe);
    prisma.organization.findUnique.mockResolvedValue({ stripeCustomerId: "cus_1", hasUsedTrial: false });

    await provider.createCheckoutSession({
      organizationId: "org-1",
      tier: "LITE" as any,
      successUrl: "https://app.test/billing",
      cancelUrl: "https://app.test/billing",
    });

    const params = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(params.subscription_data.trial_period_days).toBeUndefined();
  });

  it("no trial once the org has already used one, even on GROWTH/PRO", async () => {
    const stripe = fakeStripe();
    getStripeClient.mockReturnValue(stripe);
    prisma.organization.findUnique.mockResolvedValue({ stripeCustomerId: "cus_1", hasUsedTrial: true });

    await provider.createCheckoutSession({
      organizationId: "org-1",
      tier: "PRO" as any,
      successUrl: "https://app.test/billing",
      cancelUrl: "https://app.test/billing",
    });

    const params = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(params.subscription_data.trial_period_days).toBeUndefined();
  });

  it("creates and persists a new Stripe customer when the org has none yet", async () => {
    const stripe = fakeStripe();
    getStripeClient.mockReturnValue(stripe);
    prisma.organization.findUnique.mockResolvedValue({ stripeCustomerId: null, hasUsedTrial: false });
    prisma.membership.findFirst.mockResolvedValue({ email: "owner@example.com" });

    await provider.createCheckoutSession({
      organizationId: "org-1",
      tier: "GROWTH" as any,
      successUrl: "https://app.test/billing",
      cancelUrl: "https://app.test/billing",
    });

    expect(stripe.customers.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: "owner@example.com", metadata: { organizationId: "org-1" } }),
    );
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { stripeCustomerId: "cus_new" },
    });
    const params = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(params.customer).toBe("cus_new");
  });

  it("reuses an existing Stripe customer instead of creating a new one", async () => {
    const stripe = fakeStripe();
    getStripeClient.mockReturnValue(stripe);
    prisma.organization.findUnique.mockResolvedValue({ stripeCustomerId: "cus_existing", hasUsedTrial: false });

    await provider.createCheckoutSession({
      organizationId: "org-1",
      tier: "GROWTH" as any,
      successUrl: "https://app.test/billing",
      cancelUrl: "https://app.test/billing",
    });

    expect(stripe.customers.create).not.toHaveBeenCalled();
    const params = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(params.customer).toBe("cus_existing");
  });

  it("carries organizationId through client_reference_id and subscription metadata", async () => {
    const stripe = fakeStripe();
    getStripeClient.mockReturnValue(stripe);
    prisma.organization.findUnique.mockResolvedValue({ stripeCustomerId: "cus_1", hasUsedTrial: false });

    await provider.createCheckoutSession({
      organizationId: "org-42",
      tier: "GROWTH" as any,
      successUrl: "https://app.test/billing",
      cancelUrl: "https://app.test/billing",
    });

    const params = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(params.client_reference_id).toBe("org-42");
    expect(params.subscription_data.metadata).toEqual({ organizationId: "org-42" });
  });
});

describe("createPortalSession", () => {
  it("not configured when there's no Stripe client", async () => {
    getStripeClient.mockReturnValue(null);
    const res = await provider.createPortalSession({ organizationId: "org-1", returnUrl: "https://app.test/billing" });
    expect(res.configured).toBe(false);
  });

  it("errors when the org has no Stripe customer yet", async () => {
    getStripeClient.mockReturnValue(fakeStripe());
    prisma.organization.findUnique.mockResolvedValue({ stripeCustomerId: null });

    const res = await provider.createPortalSession({ organizationId: "org-1", returnUrl: "https://app.test/billing" });
    expect(res.configured).toBe(false);
  });

  it("returns a portal URL for an org with a Stripe customer", async () => {
    const stripe = fakeStripe();
    getStripeClient.mockReturnValue(stripe);
    prisma.organization.findUnique.mockResolvedValue({ stripeCustomerId: "cus_1" });

    const res = await provider.createPortalSession({ organizationId: "org-1", returnUrl: "https://app.test/billing" });
    expect(res).toEqual({ configured: true, url: "https://stripe.test/portal/1" });
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: "cus_1",
      return_url: "https://app.test/billing",
    });
  });
});

describe("handleWebhookEvent", () => {
  it("not configured when there's no Stripe client", async () => {
    getStripeClient.mockReturnValue(null);
    const res = await provider.handleWebhookEvent({ payload: "{}", signature: "sig" });
    expect(res.configured).toBe(false);
  });

  it("not configured when STRIPE_WEBHOOK_SECRET is unset, even with a client", async () => {
    getStripeClient.mockReturnValue(fakeStripe());
    const res = await provider.handleWebhookEvent({ payload: "{}", signature: "sig" });
    expect(res.configured).toBe(false);
  });

  it("throws StripeSignatureError when the signature is invalid, never 503", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    const stripe = fakeStripe();
    stripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error("bad sig");
    });
    getStripeClient.mockReturnValue(stripe);

    await expect(provider.handleWebhookEvent({ payload: "{}", signature: "bad" })).rejects.toBeInstanceOf(
      StripeSignatureError,
    );
  });

  it("returns handled:false for an event type this app doesn't act on, with no DB write", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    const stripe = fakeStripe();
    stripe.webhooks.constructEvent.mockReturnValue({ id: "evt_1", type: "customer.created", data: { object: {} } });
    getStripeClient.mockReturnValue(stripe);

    const res = await provider.handleWebhookEvent({ payload: "{}", signature: "sig" });
    expect(res).toEqual({ configured: true, handled: false });
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it("checkout.session.completed re-fetches the subscription and syncs from it, not the event payload", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    const stripe = fakeStripe();
    stripe.subscriptions.retrieve.mockResolvedValue(subscriptionFixture());
    stripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { mode: "subscription", subscription: "sub_1", client_reference_id: "org-1" } },
    });
    getStripeClient.mockReturnValue(stripe);

    const res = await provider.handleWebhookEvent({ payload: "{}", signature: "sig" });

    expect(res).toEqual({ configured: true, handled: true });
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_1");
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: expect.objectContaining({ plan: "GROWTH", planStatus: "active", stripeStatus: "active" }),
    });
  });

  it.each([
    ["trialing", { plan: "GROWTH", planStatus: "active", hasUsedTrial: true }],
    ["active", { plan: "GROWTH", planStatus: "active" }],
  ])("status %s activates the matching tier", async (status, expectedData) => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    const stripe = fakeStripe();
    stripe.subscriptions.retrieve.mockResolvedValue(subscriptionFixture({ status }));
    stripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_1",
      type: "customer.subscription.updated",
      data: { object: subscriptionFixture({ status }) },
    });
    getStripeClient.mockReturnValue(stripe);

    await provider.handleWebhookEvent({ payload: "{}", signature: "sig" });

    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: expect.objectContaining(expectedData),
    });
  });

  it("past_due keeps plan/planStatus untouched — access continues while Stripe retries", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    const stripe = fakeStripe();
    const sub = subscriptionFixture({ status: "past_due" });
    stripe.subscriptions.retrieve.mockResolvedValue(sub);
    stripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_1",
      type: "invoice.payment_failed",
      data: { object: { parent: { subscription_details: { subscription: "sub_1" } } } },
    });
    getStripeClient.mockReturnValue(stripe);

    await provider.handleWebhookEvent({ payload: "{}", signature: "sig" });

    const data = prisma.organization.update.mock.calls[0][0].data;
    expect(data.plan).toBeUndefined();
    expect(data.planStatus).toBeUndefined();
    expect(data.stripeStatus).toBe("past_due");
  });

  it.each(["canceled", "unpaid", "incomplete_expired"])(
    "status %s drops the org to the Pay as you sell (Connect) plan, never deleting data",
    async (status) => {
      vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
      const stripe = fakeStripe();
      stripe.subscriptions.retrieve.mockResolvedValue(subscriptionFixture({ status }));
      stripe.webhooks.constructEvent.mockReturnValue({
        id: "evt_1",
        type: "customer.subscription.deleted",
        data: { object: subscriptionFixture({ status }) },
      });
      getStripeClient.mockReturnValue(stripe);

      await provider.handleWebhookEvent({ payload: "{}", signature: "sig" });

      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: "org-1" },
        data: expect.objectContaining({ plan: "CONNECT", planStatus: "active" }),
      });
    },
  );

  it("invoice.paid resolves the subscription id from parent.subscription_details, not a top-level field", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    const stripe = fakeStripe();
    stripe.subscriptions.retrieve.mockResolvedValue(subscriptionFixture());
    stripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_1",
      type: "invoice.paid",
      data: { object: { parent: { subscription_details: { subscription: "sub_1" } } } },
    });
    getStripeClient.mockReturnValue(stripe);

    await provider.handleWebhookEvent({ payload: "{}", signature: "sig" });

    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_1");
  });

  it("is idempotent: processing the same event twice converges to the same write", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    const stripe = fakeStripe();
    stripe.subscriptions.retrieve.mockResolvedValue(subscriptionFixture());
    const event = {
      id: "evt_1",
      type: "customer.subscription.updated",
      data: { object: subscriptionFixture() },
    };
    stripe.webhooks.constructEvent.mockReturnValue(event);
    getStripeClient.mockReturnValue(stripe);

    await provider.handleWebhookEvent({ payload: "{}", signature: "sig" });
    await provider.handleWebhookEvent({ payload: "{}", signature: "sig" });

    expect(prisma.organization.update).toHaveBeenCalledTimes(2);
    expect(prisma.organization.update.mock.calls[0]).toEqual(prisma.organization.update.mock.calls[1]);
  });
});

describe("syncExtraVenueQuantity", () => {
  it("not configured when there's no Stripe client", async () => {
    getStripeClient.mockReturnValue(null);
    const res = await provider.syncExtraVenueQuantity({ organizationId: "org-1", quantity: 2 });
    expect(res.configured).toBe(false);
  });

  it("not configured when there's no extra-venue price env var", async () => {
    vi.stubEnv("STRIPE_PRICE_EXTRA_VENUE", "");
    getStripeClient.mockReturnValue(fakeStripe());
    const res = await provider.syncExtraVenueQuantity({ organizationId: "org-1", quantity: 2 });
    expect(res.configured).toBe(false);
  });

  it("not configured when the org has no real Stripe subscription — the mock path", async () => {
    getStripeClient.mockReturnValue(fakeStripe());
    prisma.organization.findUnique.mockResolvedValue({ stripeSubscriptionId: null });
    const res = await provider.syncExtraVenueQuantity({ organizationId: "org-1", quantity: 2 });
    expect(res.configured).toBe(false);
  });

  it("creates a new subscription item when quantity > 0 and none exists yet", async () => {
    const stripe = fakeStripe();
    stripe.subscriptions.retrieve.mockResolvedValue(subscriptionFixture({ items: { data: [] } }));
    getStripeClient.mockReturnValue(stripe);
    prisma.organization.findUnique.mockResolvedValue({ stripeSubscriptionId: "sub_1" });

    const res = await provider.syncExtraVenueQuantity({ organizationId: "org-1", quantity: 2 });

    expect(res.configured).toBe(true);
    expect(stripe.subscriptionItems.create).toHaveBeenCalledWith(
      expect.objectContaining({ subscription: "sub_1", price: "price_extra_venue", quantity: 2 }),
    );
  });

  it("updates the existing item's quantity when one already exists", async () => {
    const stripe = fakeStripe();
    stripe.subscriptions.retrieve.mockResolvedValue(
      subscriptionFixture({
        items: { data: [{ id: "si_extra", price: { id: "price_extra_venue" } }] },
      }),
    );
    getStripeClient.mockReturnValue(stripe);
    prisma.organization.findUnique.mockResolvedValue({ stripeSubscriptionId: "sub_1" });

    await provider.syncExtraVenueQuantity({ organizationId: "org-1", quantity: 3 });

    expect(stripe.subscriptionItems.update).toHaveBeenCalledWith(
      "si_extra",
      expect.objectContaining({ quantity: 3 }),
    );
  });

  it("deletes the item when quantity drops to 0", async () => {
    const stripe = fakeStripe();
    stripe.subscriptions.retrieve.mockResolvedValue(
      subscriptionFixture({
        items: { data: [{ id: "si_extra", price: { id: "price_extra_venue" } }] },
      }),
    );
    getStripeClient.mockReturnValue(stripe);
    prisma.organization.findUnique.mockResolvedValue({ stripeSubscriptionId: "sub_1" });

    await provider.syncExtraVenueQuantity({ organizationId: "org-1", quantity: 0 });

    expect(stripe.subscriptionItems.del).toHaveBeenCalledWith("si_extra", expect.anything());
    expect(stripe.subscriptionItems.create).not.toHaveBeenCalled();
    expect(stripe.subscriptionItems.update).not.toHaveBeenCalled();
  });
});
