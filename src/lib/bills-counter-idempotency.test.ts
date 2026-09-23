import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prisma-mock");
  return { prisma: createPrismaMock() };
});
vi.mock("@/lib/realtime", () => ({ notifyRestaurant: vi.fn() }));
vi.mock("@/lib/log", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { addItemsToCounterBill } from "@/lib/bills";
import { prisma as prismaImport } from "@/lib/prisma";
const prisma = prismaImport as any;

// Regression test for Phase 3.1: addItemsToCounterBill (the counter-sale
// order path) never accepted a clientRequestId at all — it hardcoded
// idemKey: null, so a dropped-response retry from the counter-sale screen
// had no retry-safety and could ring up the same items twice. Confirms the
// same short-circuit addItemsForTable already relies on for the customer/
// table-service flow now also protects the counter path.
describe("addItemsToCounterBill idempotency", () => {
  beforeEach(() => {
    vi.mocked(prisma.order.findUnique).mockReset();
    vi.mocked(prisma.$transaction).mockClear();
  });

  it("a retried submit with an already-landed clientRequestId short-circuits to success without a second transaction", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({ id: "order-1" });

    const res = await addItemsToCounterBill(
      "bill-1",
      "rest-1",
      [{ menuItemId: "m1", quantity: 1 }],
      undefined,
      "retry-key-123",
    );

    expect(res).toEqual({ ok: true });
    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { clientRequestId: "retry-key-123" },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("a brand-new clientRequestId proceeds to attempt the order (no early short-circuit)", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("boom"));

    await expect(
      addItemsToCounterBill("bill-1", "rest-1", [{ menuItemId: "m1", quantity: 1 }], undefined, "new-key"),
    ).rejects.toThrow("boom");
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
