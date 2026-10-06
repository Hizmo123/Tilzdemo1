import { describe, it, expect, vi, beforeEach } from "vitest";

const { getAuthz } = vi.hoisted(() => ({ getAuthz: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthz }));
vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prisma-mock");
  return { prisma: createPrismaMock() };
});
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { subscribe } from "./actions";
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

  it("every public tier (LITE/GROWTH/PRO) is always allowed, no Square check performed", async () => {
    getAuthz.mockResolvedValue(authz({ plan: "LITE" }));

    const res = await subscribe("GROWTH" as any);

    expect(res).toEqual({ ok: true });
    expect(prisma.squareConnection.findUnique).not.toHaveBeenCalled();
  });
});
