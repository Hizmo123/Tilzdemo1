import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireStaffForSlug, createCounterBill, addItemsToCounterBill, getEntitlements } = vi.hoisted(() => ({
  requireStaffForSlug: vi.fn(),
  createCounterBill: vi.fn(),
  addItemsToCounterBill: vi.fn(),
  getEntitlements: vi.fn(),
}));

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prisma-mock");
  return { prisma: createPrismaMock() };
});
vi.mock("@/lib/staff-auth", () => ({ requireStaffForSlug }));
vi.mock("@/lib/bills", () => ({
  createCounterBill,
  addItemsToCounterBill,
  staffCloseBillById: vi.fn(),
}));
vi.mock("@/lib/entitlements", () => ({ getEntitlements }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { startCounterSale, addCounterItems } from "./actions";
import { prisma as prismaImport } from "@/lib/prisma";
const prisma = prismaImport as any;

// Security regression: Lite is menu-only (no live ordering at all). Both
// counter-sale entry points only checked orderingBlocked — a flag that's
// only ever true for a lapsed PAID subscription — so a Lite org (never
// subscribed, never blocked) could still open and add items to a counter
// sale, bypassing the plan entirely.
describe("counter sale actions refuse a Lite (no-ordering) plan", () => {
  beforeEach(() => {
    requireStaffForSlug.mockReset();
    createCounterBill.mockReset();
    addItemsToCounterBill.mockReset();
    getEntitlements.mockReset();
    vi.mocked(prisma.location.findFirst).mockReset();

    requireStaffForSlug.mockResolvedValue({
      staff: { id: "staff-1", role: "STAFF" },
      restaurant: { id: "rest-1", organizationId: "org-1" },
    });
    vi.mocked(prisma.location.findFirst).mockResolvedValue({ id: "loc-1" });
  });

  it("startCounterSale refuses to open a sale when the plan has no ordering", async () => {
    getEntitlements.mockResolvedValue({ ordering: false, orderingBlocked: false });

    const res = await startCounterSale("venue", "loc-1");

    expect(res).toEqual({ error: "Live ordering isn't included in this venue's plan." });
    expect(createCounterBill).not.toHaveBeenCalled();
  });

  it("startCounterSale succeeds when the plan does include ordering", async () => {
    getEntitlements.mockResolvedValue({ ordering: true, orderingBlocked: false });
    createCounterBill.mockResolvedValue({ billId: "bill-1" });

    const res = await startCounterSale("venue", "loc-1");

    expect(res).toEqual({ ok: true, billId: "bill-1" });
    expect(createCounterBill).toHaveBeenCalledWith("rest-1", "loc-1");
  });

  it("addCounterItems refuses to add items when the plan has no ordering, even though orderingBlocked is false", async () => {
    getEntitlements.mockResolvedValue({ ordering: false, orderingBlocked: false });

    const res = await addCounterItems("venue", "bill-1", [{ menuItemId: "m1", quantity: 1 }]);

    expect(res).toEqual({ error: "Live ordering isn't included in this venue's plan." });
    expect(addItemsToCounterBill).not.toHaveBeenCalled();
  });

  it("addCounterItems still refuses when orderingBlocked is true (unchanged behaviour)", async () => {
    getEntitlements.mockResolvedValue({ ordering: true, orderingBlocked: true });

    const res = await addCounterItems("venue", "bill-1", [{ menuItemId: "m1", quantity: 1 }]);

    expect(res).toEqual({ error: "This venue can't take new orders right now — contact the owner." });
    expect(addItemsToCounterBill).not.toHaveBeenCalled();
  });

  it("addCounterItems succeeds on a plan with ordering that isn't blocked", async () => {
    getEntitlements.mockResolvedValue({ ordering: true, orderingBlocked: false });
    addItemsToCounterBill.mockResolvedValue({ ok: true });

    const res = await addCounterItems("venue", "bill-1", [{ menuItemId: "m1", quantity: 1 }]);

    expect(res).toEqual({ ok: true });
    expect(addItemsToCounterBill).toHaveBeenCalled();
  });
});
