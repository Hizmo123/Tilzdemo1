import { describe, it, expect, vi, beforeEach } from "vitest";

const { getAuthz, emailBillReceipt } = vi.hoisted(() => ({
  getAuthz: vi.fn(),
  emailBillReceipt: vi.fn(),
}));
vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prisma-mock");
  return { prisma: createPrismaMock() };
});
vi.mock("@/lib/auth", () => ({ getAuthz }));
vi.mock("@/lib/receipt-delivery", () => ({ emailBillReceipt }));

import { emailReceiptCopy } from "./actions";
import { prisma as prismaImport } from "@/lib/prisma";
const prisma = prismaImport as any;

// Regression test for emailReceiptCopy: previously had NO permission check at
// all, so any authenticated dashboard user could email a copy of ANY org's
// bill to any address. Now gated on bills:view AND scoped to the caller's own
// org.
describe("emailReceiptCopy", () => {
  beforeEach(() => {
    vi.mocked(prisma.bill.findFirst).mockReset();
    emailBillReceipt.mockReset();
    getAuthz.mockReset();
  });

  it("blocks a caller with no bills:view permission", async () => {
    getAuthz.mockResolvedValue({
      can: () => false,
      membership: { organizationId: "org-a" },
    });
    const res = await emailReceiptCopy("bill-1", "someone@example.com");
    expect(res).toEqual({ error: "Not permitted." });
    expect(prisma.bill.findFirst).not.toHaveBeenCalled();
    expect(emailBillReceipt).not.toHaveBeenCalled();
  });

  it("blocks emailing a bill that belongs to a DIFFERENT org, even with bills:view", async () => {
    getAuthz.mockResolvedValue({
      can: () => true,
      membership: { organizationId: "org-a" },
    });
    // Simulates the DB filter actually scoping by org-a — bill-1 belongs to
    // org-b, so the (correctly-scoped) query finds nothing.
    vi.mocked(prisma.bill.findFirst).mockResolvedValue(null);
    const res = await emailReceiptCopy("bill-1", "attacker@example.com");
    expect(res).toEqual({ error: "Bill not found." });
    expect(emailBillReceipt).not.toHaveBeenCalled();
  });

  it("allows the legitimate path: bills:view permission + bill within the caller's own org", async () => {
    getAuthz.mockResolvedValue({
      can: () => true,
      membership: { organizationId: "org-a" },
    });
    vi.mocked(prisma.bill.findFirst).mockResolvedValue({ id: "bill-1" });
    emailBillReceipt.mockResolvedValue({ ok: true });
    const res = await emailReceiptCopy("bill-1", "owner@example.com");
    expect(emailBillReceipt).toHaveBeenCalledWith("bill-1", "owner@example.com");
    expect(res).toEqual({ ok: true });
  });
});
