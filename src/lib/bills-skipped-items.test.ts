import { describe, it, expect, vi, beforeEach } from "vitest";

const { notifyRestaurant } = vi.hoisted(() => ({ notifyRestaurant: vi.fn() }));

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prisma-mock");
  return { prisma: createPrismaMock() };
});
vi.mock("@/lib/realtime", () => ({ notifyRestaurant }));
vi.mock("@/lib/log", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { addItemsForTable } from "@/lib/bills";
import { prisma as prismaImport } from "@/lib/prisma";
const prisma = prismaImport as any;

// Regression test for Phase 3.4: createOrderWithItems silently dropped any
// line whose menu item was deleted/86'd between the customer building their
// cart and sending it — the caller (and, until this fix, the success
// screen) had no way to know a line never made it onto the ticket.
// addItemsForTable now surfaces which menuItemIds were skipped.
describe("addItemsForTable surfaces skipped lines", () => {
  beforeEach(() => {
    vi.mocked(prisma.order.findUnique).mockReset();
    vi.mocked(prisma.bill.findFirst).mockResolvedValue({ id: "bill-1" });
    vi.mocked(prisma.restaurant.update).mockResolvedValue({
      orderSeq: 5,
      staffApproval: false,
      paymentTiming: "after",
      requirePaymentBeforeOrder: false,
    });
    vi.mocked(prisma.order.create).mockResolvedValue({ id: "order-1" });
    vi.mocked(prisma.billItem.createMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.billItem.findMany).mockResolvedValue([
      { voided: false, comped: false, lineTotalCents: 500 },
    ]);
    vi.mocked(prisma.bill.findUnique).mockResolvedValue({ discountCents: 0 });
    vi.mocked(prisma.bill.update).mockResolvedValue({});
  });

  it("reports the menuItemId of a line that was dropped (86'd/deleted) alongside the ones that landed", async () => {
    // Only m1 comes back from the availability-filtered lookup — m2 has
    // been 86'd (or deleted) since the cart was built.
    vi.mocked(prisma.menuItem.findMany).mockResolvedValue([
      { id: "m1", name: "Burger", priceCents: 500, station: null, category: { station: null }, modifierGroups: [] },
    ]);

    const res = await addItemsForTable(
      { tableId: "table-1", restaurantId: "rest-1", currency: "AUD" },
      [
        { menuItemId: "m1", quantity: 1 },
        { menuItemId: "m2", quantity: 1 },
      ],
      "CUSTOMER",
    );

    expect(res).toMatchObject({ ok: true, skippedMenuItemIds: ["m2"] });
  });

  it("reports no skipped items when every line lands", async () => {
    vi.mocked(prisma.menuItem.findMany).mockResolvedValue([
      { id: "m1", name: "Burger", priceCents: 500, station: null, category: { station: null }, modifierGroups: [] },
    ]);

    const res = await addItemsForTable(
      { tableId: "table-1", restaurantId: "rest-1", currency: "AUD" },
      [{ menuItemId: "m1", quantity: 1 }],
      "CUSTOMER",
    );

    expect(res).toMatchObject({ ok: true, skippedMenuItemIds: [] });
  });
});
