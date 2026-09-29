import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prisma-mock");
  return { prisma: createPrismaMock() };
});

import { canSetStations } from "@/lib/entitlements";
import { prisma as prismaImport } from "@/lib/prisma";
const prisma = prismaImport as any;

// Regression test for the single-call kitchen-station-limit bypass:
// canCreateStation (now canSetStations) used to compare the CURRENT station
// count against the limit ("may I add one more?"), never how many were
// actually being requested. Its caller, updateKitchenStations, writes the
// WHOLE submitted array in one action call — so a BASIC org
// (kdsStationLimit: 2) sitting at 1 station passed the old check (1 >= 2 is
// false) and could write 26 stations in a single save. Fixed by comparing
// the requested total directly, and by taking restaurantId explicitly
// instead of resolving "the org's restaurant" via an unscoped findFirst
// (which returned an ARBITRARY venue on a multi-venue org).
describe("canSetStations", () => {
  const orgId = "org-1";
  const restaurantId = "rest-1";

  beforeEach(() => {
    vi.mocked(prisma.restaurant.findUnique).mockReset();
    vi.mocked(prisma.organization.findUnique).mockReset();
  });

  function mockOwnedRestaurant(organizationId = orgId) {
    vi.mocked(prisma.restaurant.findUnique).mockResolvedValue({ organizationId });
  }
  function mockOrg(plan: string) {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      plan,
      subscriptionLapsedAt: null,
      connectPlusEnabled: false,
      connectBrandingHidden: false,
    });
  }

  it("BASIC (limit 2): a single-call jump from 1 station to 26 is refused — the OLD current-count check would have allowed it", async () => {
    mockOwnedRestaurant();
    mockOrg("BASIC");

    const result = await canSetStations(orgId, restaurantId, 26);

    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toMatch(/up to 2 kitchen station/i);
  });

  it("BASIC (limit 2): requesting exactly the limit is allowed", async () => {
    mockOwnedRestaurant();
    mockOrg("BASIC");

    expect((await canSetStations(orgId, restaurantId, 2)).allowed).toBe(true);
  });

  it("BASIC: a same-length re-save that's already over the limit is still refused (not just growth)", async () => {
    mockOwnedRestaurant();
    mockOrg("BASIC");

    // Requesting 3 when already "at" 3 (e.g. after a downgrade) must still
    // be refused — this only reads the requested count, so there's no
    // "unchanged length" special case to accidentally let through.
    const result = await canSetStations(orgId, restaurantId, 3);
    expect(result.allowed).toBe(false);
  });

  it("GROWTH (unlimited): any requested count is allowed", async () => {
    mockOwnedRestaurant();
    mockOrg("GROWTH");

    expect((await canSetStations(orgId, restaurantId, 40)).allowed).toBe(true);
  });

  it("refuses when restaurantId doesn't belong to organizationId, rather than silently checking org-level entitlements against a foreign restaurant", async () => {
    mockOwnedRestaurant("some-other-org");
    mockOrg("GROWTH");

    const result = await canSetStations(orgId, restaurantId, 1);
    expect(result.allowed).toBe(false);
  });
});
