import { describe, it, expect, vi, beforeEach } from "vitest";

const { notifyRestaurant } = vi.hoisted(() => ({ notifyRestaurant: vi.fn() }));

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prisma-mock");
  return { prisma: createPrismaMock() };
});
vi.mock("@/lib/realtime", () => ({ notifyRestaurant }));
vi.mock("@/lib/log", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { staffCloseBill } from "@/lib/bills";
import { prisma as prismaImport } from "@/lib/prisma";
const prisma = prismaImport as any;

// Regression test for Phase 4.1: staffCloseBill's (and payBillAmount's,
// same pattern) compare-and-swap only guarded amountPaidCents, not
// totalCents. A discount/void/comp/added item landing between the read and
// the write could change totalCents without touching amountPaidCents, so
// the old CAS would still succeed and commit a stale total. Confirms the
// CAS now fails (and the caller retries against a fresh read) when
// totalCents has moved, even though amountPaidCents hasn't.
describe("staffCloseBill CAS guards totalCents as well as amountPaidCents", () => {
  beforeEach(() => {
    notifyRestaurant.mockReset();
    vi.mocked(prisma.cashDrawerSession.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.payment.create).mockResolvedValue({});
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 0 });
  });

  it("retries (re-reads) when totalCents has changed since the read, even though amountPaidCents matches", async () => {
    // First read: totalCents 1000. A concurrent discount then drops it to
    // 800 in the "real" row — simulated by the updateMany mock rejecting a
    // where clause that still names the stale 1000.
    let readCount = 0;
    vi.mocked(prisma.bill.findFirst).mockImplementation(async () => {
      readCount++;
      return {
        id: "bill-1",
        totalCents: readCount === 1 ? 1000 : 800,
        amountPaidCents: 0,
        currency: "AUD",
        locationId: null,
      };
    });
    vi.mocked(prisma.bill.updateMany).mockImplementation(async (args: any) => {
      // Only the CURRENT real total (800) is accepted, proving totalCents
      // is actually part of the CAS condition rather than ignored.
      return args.where.totalCents === 800 ? { count: 1 } : { count: 0 };
    });

    const res = await staffCloseBill("table-1", "rest-1", "OTHER");

    expect(res).toEqual({ paid: true });
    // Read twice: the first (stale) attempt lost the CAS and retried.
    expect(readCount).toBe(2);
    expect(prisma.bill.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ totalCents: 800 }) }),
    );
  });
});
