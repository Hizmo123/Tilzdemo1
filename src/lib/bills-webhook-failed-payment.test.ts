import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prisma-mock");
  return { prisma: createPrismaMock() };
});
vi.mock("@/lib/log", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { syncSquarePaymentStatus } from "@/lib/bills";
import { prisma as prismaImport } from "@/lib/prisma";
const prisma = prismaImport as any;

// Regression test for Phase 4.3: a failed/reversed Square payment webhook
// decremented Bill.amountPaidCents but never re-derived Bill.status (a bill
// could sit at PAID/PARTIALLY_PAID with less money behind it than that
// implies) and never rolled back the BillItem.paidQuantity an item-split
// payment had reserved (Payment.itemAllocations), leaving those units
// permanently stuck showing as paid.
describe("syncSquarePaymentStatus on a FAILED webhook", () => {
  beforeEach(() => {
    vi.mocked(prisma.billItem.updateMany).mockReset();
    vi.mocked(prisma.bill.update).mockReset();
    vi.mocked(prisma.payment.update).mockReset();
  });

  it("reverts a fully-PAID bill back to PARTIALLY_PAID and clears paidAt when the failed payment covered the rest", async () => {
    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: "pay-1",
      billId: "bill-1",
      status: "SUCCEEDED",
      amountCents: 500,
      tipCents: 0,
      itemAllocations: null,
    });
    vi.mocked(prisma.bill.findUniqueOrThrow).mockResolvedValue({
      id: "bill-1",
      amountPaidCents: 1500,
      tipCents: 0,
      totalCents: 1500,
      status: "PAID",
      paidAt: new Date("2026-01-01"),
    });

    await syncSquarePaymentStatus("sq-pay-1", "FAILED");

    expect(prisma.bill.update).toHaveBeenCalledWith({
      where: { id: "bill-1" },
      data: {
        amountPaidCents: 1000,
        tipCents: 0,
        status: "PARTIALLY_PAID",
        paidAt: null,
      },
    });
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: "pay-1" },
      data: { status: "FAILED" },
    });
  });

  it("rolls back the exact paidQuantity an item-split payment reserved", async () => {
    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: "pay-2",
      billId: "bill-1",
      status: "SUCCEEDED",
      amountCents: 500,
      tipCents: 0,
      itemAllocations: [{ billItemId: "item-1", count: 2 }],
    });
    vi.mocked(prisma.bill.findUniqueOrThrow).mockResolvedValue({
      id: "bill-1",
      amountPaidCents: 500,
      tipCents: 0,
      totalCents: 1500,
      status: "PARTIALLY_PAID",
      paidAt: null,
    });

    await syncSquarePaymentStatus("sq-pay-2", "FAILED");

    expect(prisma.billItem.updateMany).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { paidQuantity: { decrement: 2 } },
    });
  });

  it("drops the bill back to OPEN when the failed payment was the only money collected", async () => {
    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: "pay-3",
      billId: "bill-1",
      status: "SUCCEEDED",
      amountCents: 1000,
      tipCents: 0,
      itemAllocations: null,
    });
    vi.mocked(prisma.bill.findUniqueOrThrow).mockResolvedValue({
      id: "bill-1",
      amountPaidCents: 1000,
      tipCents: 0,
      totalCents: 1500,
      status: "PARTIALLY_PAID",
      paidAt: null,
    });

    await syncSquarePaymentStatus("sq-pay-3", "FAILED");

    expect(prisma.bill.update).toHaveBeenCalledWith({
      where: { id: "bill-1" },
      data: { amountPaidCents: 0, tipCents: 0, status: "OPEN", paidAt: null },
    });
  });
});
