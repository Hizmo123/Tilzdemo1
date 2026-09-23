import { describe, it, expect, vi, beforeEach } from "vitest";

const { notifyRestaurant, resolveVisit } = vi.hoisted(() => ({
  notifyRestaurant: vi.fn(),
  resolveVisit: vi.fn(),
}));

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prisma-mock");
  return { prisma: createPrismaMock() };
});
vi.mock("@/lib/realtime", () => ({ notifyRestaurant }));
vi.mock("@/lib/bills", () => ({ resolveVisit }));

import { createCustomerRequest, updateRequestStatus } from "@/lib/requests";
import { prisma as prismaImport } from "@/lib/prisma";
const prisma = prismaImport as any;

// Regression test for Phase 3.3: "Call staff" (createCustomerRequest, every
// request type) and staff acknowledging/completing a request
// (updateRequestStatus) wrote to the database but never called
// notifyRestaurant — so a request only showed up on a staff screen's next
// unrelated poll/page load, not live.
describe("customer request realtime notifications", () => {
  beforeEach(() => {
    notifyRestaurant.mockReset();
    resolveVisit.mockReset();
    vi.mocked(prisma.customerRequest.findFirst).mockReset();
    vi.mocked(prisma.customerRequest.create).mockReset();
    vi.mocked(prisma.customerRequest.update).mockReset();
  });

  it("createCustomerRequest (Call staff) notifies the restaurant after creating the request", async () => {
    resolveVisit.mockResolvedValue({
      ok: true,
      visit: { tableId: "table-1", restaurantId: "rest-1" },
    });
    vi.mocked(prisma.customerRequest.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.customerRequest.create).mockResolvedValue({ id: "req-1" });

    await createCustomerRequest("token-1", "ASSISTANCE");

    expect(notifyRestaurant).toHaveBeenCalledWith("rest-1");
  });

  it("updateRequestStatus (staff acknowledging/completing) also notifies the restaurant", async () => {
    vi.mocked(prisma.customerRequest.findFirst).mockResolvedValue({
      id: "req-1",
      status: "OPEN",
      acknowledgedAt: null,
      completedAt: null,
    });
    vi.mocked(prisma.customerRequest.update).mockResolvedValue({});

    await updateRequestStatus("req-1", "rest-1", "ACKNOWLEDGED");

    expect(notifyRestaurant).toHaveBeenCalledWith("rest-1");
  });
});
