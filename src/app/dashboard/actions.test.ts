import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireUser, getAuthz, canCreateVenue } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getAuthz: vi.fn(),
  canCreateVenue: vi.fn(),
}));
vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prisma-mock");
  return { prisma: createPrismaMock() };
});
vi.mock("@/lib/auth", () => ({ requireUser, getAuthz }));
vi.mock("@/lib/entitlements", () => ({
  canCreateVenue,
  getPublishReadiness: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createRestaurant } from "./actions";
import { prisma as prismaImport } from "@/lib/prisma";
const prisma = prismaImport as any;

// Regression test for the createRestaurant entitlement bypass: this fallback
// path (reached by a user who already has a membership but no restaurant
// under it yet) previously skipped the plan/venue-limit check that every
// other venue-creation path goes through, letting a user mint unlimited orgs
// off-plan. Now routed through the same canCreateVenue() gate.
describe("createRestaurant entitlement gate", () => {
  beforeEach(() => {
    requireUser.mockReset();
    canCreateVenue.mockReset();
    vi.mocked(prisma.membership.findFirst).mockReset();
    vi.mocked(prisma.restaurant.findUnique).mockReset();
    vi.mocked(prisma.$transaction).mockClear();
    requireUser.mockResolvedValue({ id: "user-1", email: "u@example.com" });
  });

  const formData = () => {
    const fd = new FormData();
    fd.set("restaurantName", "Test Cafe");
    fd.set("locationName", "Main");
    return fd;
  };

  it("fails closed: an existing member whose org has hit its venue limit is blocked, and nothing is created", async () => {
    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      organizationId: "org-a",
    });
    canCreateVenue.mockResolvedValue({ allowed: false, reason: "Venue limit reached for your plan." });

    const res = await createRestaurant({}, formData());

    expect(res).toEqual({ error: "Venue limit reached for your plan." });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("allows an existing member whose org is within its venue limit", async () => {
    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      organizationId: "org-a",
    });
    canCreateVenue.mockResolvedValue({ allowed: true });
    vi.mocked(prisma.restaurant.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.organization.create).mockResolvedValue({ id: "org-new" });
    vi.mocked(prisma.membership.create).mockResolvedValue({});
    vi.mocked(prisma.restaurant.create).mockResolvedValue({ id: "rest-new" });

    const res = await createRestaurant({}, formData());

    expect(res).toEqual({});
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("a genuinely membership-less user (defense-in-depth; normally redirected to /onboarding before reaching here) is not blocked by a nonexistent org check", async () => {
    vi.mocked(prisma.membership.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.restaurant.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.organization.create).mockResolvedValue({ id: "org-new" });
    vi.mocked(prisma.membership.create).mockResolvedValue({});
    vi.mocked(prisma.restaurant.create).mockResolvedValue({ id: "rest-new" });

    const res = await createRestaurant({}, formData());

    expect(canCreateVenue).not.toHaveBeenCalled();
    expect(res).toEqual({});
  });
});
