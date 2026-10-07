import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { getAuthz } = vi.hoisted(() => ({ getAuthz: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthz }));
vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prisma-mock");
  return { prisma: createPrismaMock() };
});
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { subscribe, cancelSubscription, manageBilling } from "./actions";
import { prisma as prismaImport } from "@/lib/prisma";
const prisma = prismaImport as any;

// Regression tests for subscribe()'s server-side allow-list: the UI not
// offering Basic/Connect (PlanPicker, the Billing grid) is cosmetic on its
// own — this is what actually stops a POST crafted outside the UI from
// putting a new org on a grandfathered-only tier, and what keeps Connect
// reachable ONLY through its own Square-first path, never a bare switch.
describe("subscribe() tier allow-list", () => {
  const authz = (org: Partial<{ plan: string; restaurants: { id: string }[]; hasUsedTrial: boolean }>) => ({
    can: () => true,
    membership: {
      organization: { id: "org-1", hasUsedTrial: false, restaurants: [{ id: "rest-1" }], ...org },
    },
    user: { id: "user-1", email: "o@example.com" },
  });

  beforeEach(() => {
    getAuthz.mockReset();
    vi.mocked(prisma.organization.update).mockReset().mockResolvedValue({});
    vi.mocked(prisma.squareConnection.findUnique).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("a new (LITE) org trying to switch straight to BASIC is rejected", async () => {
    getAuthz.mockResolvedValue(authz({ plan: "LITE" }));

    const res = await subscribe("BASIC" as any);

    expect(res).toEqual({ error: "That plan isn't available." });
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it("an org already on BASIC re-selecting BASIC is allowed (grandfathered, not a new switch)", async () => {
    getAuthz.mockResolvedValue(authz({ plan: "BASIC" }));

    const res = await subscribe("BASIC" as any);

    expect(res).toEqual({ ok: true });
    expect(prisma.organization.update).toHaveBeenCalled();
  });

  it("an org without an active Square connection trying to switch to CONNECT is rejected", async () => {
    getAuthz.mockResolvedValue(authz({ plan: "GROWTH" }));
    vi.mocked(prisma.squareConnection.findUnique).mockResolvedValue(null);

    const res = await subscribe("CONNECT" as any);

    expect(res).toEqual({ error: "That plan isn't available." });
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it("an org with an active Square connection switching to CONNECT is allowed — the Square-first path", async () => {
    getAuthz.mockResolvedValue(authz({ plan: "GROWTH" }));
    vi.mocked(prisma.squareConnection.findUnique).mockResolvedValue({ revokedAt: null });

    const res = await subscribe("CONNECT" as any);

    expect(res).toEqual({ ok: true });
    expect(prisma.organization.update).toHaveBeenCalled();
  });

  it("a REVOKED Square connection does not count as the Square path", async () => {
    getAuthz.mockResolvedValue(authz({ plan: "GROWTH" }));
    vi.mocked(prisma.squareConnection.findUnique).mockResolvedValue({ revokedAt: new Date() });

    const res = await subscribe("CONNECT" as any);

    expect(res).toEqual({ error: "That plan isn't available." });
  });

  it("every public tier (LITE/GROWTH/PRO) is allowed once paid plans are open, no Square check performed", async () => {
    vi.stubEnv("BILLING_ENABLED", "true");
    getAuthz.mockResolvedValue(authz({ plan: "LITE" }));

    const res = await subscribe("GROWTH" as any);

    expect(res).toEqual({ ok: true });
    expect(prisma.squareConnection.findUnique).not.toHaveBeenCalled();
  });
});

// Regression tests for the billing-foundation gate: LITE/GROWTH/PRO are
// real subscription prices now (Lite included), so subscribe() must not let
// anyone grant themselves one for free before Stripe is actually wired up —
// see src/lib/billing/gate.ts#paidPlansOpen.
describe("subscribe() paid-plan gate", () => {
  const authz = (org: Partial<{ plan: string; restaurants: { id: string }[]; hasUsedTrial: boolean }>, userId = "user-1") => ({
    can: () => true,
    membership: {
      organization: { id: "org-1", hasUsedTrial: false, restaurants: [{ id: "rest-1" }], ...org },
    },
    user: { id: userId, email: "o@example.com" },
  });

  beforeEach(() => {
    getAuthz.mockReset();
    vi.mocked(prisma.organization.update).mockReset().mockResolvedValue({});
    vi.mocked(prisma.squareConnection.findUnique).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("flag off: LITE/GROWTH/PRO self-assignment is rejected", async () => {
    getAuthz.mockResolvedValue(authz({ plan: "LITE" }));

    for (const tier of ["LITE", "GROWTH", "PRO"] as const) {
      const res = await subscribe(tier as any);
      expect(res.error).toMatch(/opening soon|early access/i);
    }
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it("flag off: a platform admin can still self-assign GROWTH", async () => {
    vi.stubEnv("PLATFORM_ADMIN_USER_IDS", "admin-1");
    getAuthz.mockResolvedValue(authz({ plan: "LITE" }, "admin-1"));

    const res = await subscribe("GROWTH" as any);

    expect(res).toEqual({ ok: true });
    expect(prisma.organization.update).toHaveBeenCalled();
  });

  it("flag off: CONNECT is never gated (no subscription to self-assign)", async () => {
    getAuthz.mockResolvedValue(authz({ plan: "GROWTH" }));
    vi.mocked(prisma.squareConnection.findUnique).mockResolvedValue({ revokedAt: null });

    const res = await subscribe("CONNECT" as any);

    expect(res).toEqual({ ok: true });
  });

  it("flag on: routes through the billing provider, which falls back to the mock write since Stripe isn't configured", async () => {
    vi.stubEnv("BILLING_ENABLED", "true");
    getAuthz.mockResolvedValue(authz({ plan: "LITE" }));

    const res = await subscribe("GROWTH" as any);

    expect(res).toEqual({ ok: true });
    expect(prisma.organization.update).toHaveBeenCalled();
  });
});

describe("cancelSubscription() paid-plan gate", () => {
  const authz = (userId = "user-1", org: Partial<{ plan: string; stripeSubscriptionId: string | null }> = {}) => ({
    can: () => true,
    membership: { organization: { id: "org-1", plan: "GROWTH", stripeSubscriptionId: null, ...org } },
    user: { id: userId, email: "o@example.com" },
  });

  beforeEach(() => {
    getAuthz.mockReset();
    vi.mocked(prisma.organization.update).mockReset().mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("flag off: cancelling (downgrading to the now-paid Lite) is rejected", async () => {
    getAuthz.mockResolvedValue(authz());

    const res = await cancelSubscription();

    expect(res.error).toMatch(/opening soon|early access/i);
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it("flag on: cancelling succeeds", async () => {
    vi.stubEnv("BILLING_ENABLED", "true");
    getAuthz.mockResolvedValue(authz());

    const res = await cancelSubscription();

    expect(res).toEqual({ ok: true });
    expect(prisma.organization.update).toHaveBeenCalled();
  });

  it("flag on: an org with a REAL Stripe subscription is rejected — cancel through the portal instead", async () => {
    vi.stubEnv("BILLING_ENABLED", "true");
    getAuthz.mockResolvedValue(authz("user-1", { stripeSubscriptionId: "sub_1" }));

    const res = await cancelSubscription();

    expect(res.error).toMatch(/billing portal/i);
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });
});

// manageBilling() routes through the real billing provider (never mocked
// here) — with no STRIPE_SECRET_KEY set in the test environment, that's
// always the stub, so this also doubles as confirmation the stub's
// "not configured" result surfaces as a real error, not a silent success.
describe("manageBilling()", () => {
  beforeEach(() => {
    getAuthz.mockReset();
  });

  it("requires settings:manage", async () => {
    getAuthz.mockResolvedValue({ can: () => false, membership: null, user: { id: "user-1" } });

    const res = await manageBilling();

    expect(res.error).toBeTruthy();
  });

  it("errors clearly when Stripe isn't configured, rather than a silent no-op", async () => {
    getAuthz.mockResolvedValue({
      can: () => true,
      membership: { organization: { id: "org-1" } },
      user: { id: "user-1", email: "o@example.com" },
    });

    const res = await manageBilling();

    expect(res.ok).toBeUndefined();
    expect(res.error).toMatch(/not configured|STRIPE_SECRET_KEY/i);
  });
});
