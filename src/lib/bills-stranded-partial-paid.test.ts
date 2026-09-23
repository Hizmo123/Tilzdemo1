import { describe, it, expect, vi, beforeEach } from "vitest";

const { notifyRestaurant } = vi.hoisted(() => ({ notifyRestaurant: vi.fn() }));

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prisma-mock");
  return { prisma: createPrismaMock() };
});
vi.mock("@/lib/realtime", () => ({ notifyRestaurant }));

import { voidBillItem } from "@/lib/bills";
import { prisma as prismaImport } from "@/lib/prisma";
const prisma = prismaImport as any;

// Regression test for Phase 4.4: recompute() only ever adjusted subtotal/
// total, never status — so voiding/comping a line on a PARTIALLY_PAID bill
// that dropped the total to at or below what's already been collected left
// the bill stuck at PARTIALLY_PAID forever (nothing left owing, but never
// promoted to PAID, unable to be closed the normal way).
describe("recompute promotes a fully-covered PARTIALLY_PAID bill to PAID", () => {
  beforeEach(() => {
    notifyRestaurant.mockReset();
    vi.mocked(prisma.bill.update).mockReset();
  });

  it("voiding a line that drops the total to what's already paid settles the bill", async () => {
    vi.mocked(prisma.billItem.findFirst).mockResolvedValue({
      id: "item-1",
      billId: "bill-1",
      bill: { id: "bill-1", status: "PARTIALLY_PAID" },
    });
    vi.mocked(prisma.billItem.update).mockResolvedValue({});
    // After voiding item-1, only a $10 line remains — the $10 already paid
    // now fully covers it.
    vi.mocked(prisma.billItem.findMany).mockResolvedValue([
      { voided: false, comped: false, lineTotalCents: 1000 },
    ]);
    vi.mocked(prisma.bill.findUnique).mockResolvedValue({
      discountCents: 0,
      status: "PARTIALLY_PAID",
      amountPaidCents: 1000,
    });

    await voidBillItem("item-1", "rest-1", true);

    expect(prisma.bill.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "bill-1" },
        data: expect.objectContaining({
          subtotalCents: 1000,
          totalCents: 1000,
          status: "PAID",
        }),
      }),
    );
  });

  it("does NOT settle when the remaining total still exceeds what's been paid", async () => {
    vi.mocked(prisma.billItem.findFirst).mockResolvedValue({
      id: "item-1",
      billId: "bill-1",
      bill: { id: "bill-1", status: "PARTIALLY_PAID" },
    });
    vi.mocked(prisma.billItem.update).mockResolvedValue({});
    vi.mocked(prisma.billItem.findMany).mockResolvedValue([
      { voided: false, comped: false, lineTotalCents: 2000 },
    ]);
    vi.mocked(prisma.bill.findUnique).mockResolvedValue({
      discountCents: 0,
      status: "PARTIALLY_PAID",
      amountPaidCents: 1000,
    });

    await voidBillItem("item-1", "rest-1", true);

    const call = vi.mocked(prisma.bill.update).mock.calls[0][0];
    expect(call.data.status).toBeUndefined();
  });

  it("never touches an already-PAID bill's status (one-directional only)", async () => {
    vi.mocked(prisma.billItem.findFirst).mockResolvedValue({
      id: "item-1",
      billId: "bill-1",
      bill: { id: "bill-1", status: "OPEN" },
    });
    vi.mocked(prisma.billItem.update).mockResolvedValue({});
    vi.mocked(prisma.billItem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.bill.findUnique).mockResolvedValue({
      discountCents: 0,
      status: "PAID",
      amountPaidCents: 2000,
    });

    await voidBillItem("item-1", "rest-1", true);

    const call = vi.mocked(prisma.bill.update).mock.calls[0][0];
    expect(call.data.status).toBeUndefined();
  });
});
