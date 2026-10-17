import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireStaffForSlug, addItemsForTable, getEntitlements } = vi.hoisted(() => ({
  requireStaffForSlug: vi.fn(),
  addItemsForTable: vi.fn(),
  getEntitlements: vi.fn(),
}));

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prisma-mock");
  return { prisma: createPrismaMock() };
});
vi.mock("@/lib/staff-auth", () => ({ requireStaffForSlug }));
vi.mock("@/lib/bills", () => ({
  addItemsForTable,
  staffCloseBill: vi.fn(),
  voidBillItem: vi.fn(),
  compBillItem: vi.fn(),
  setBillDiscount: vi.fn(),
  moveBill: vi.fn(),
  mergeBills: vi.fn(),
  refundBillPayment: vi.fn(),
}));
vi.mock("@/lib/entitlements", () => ({ getEntitlements }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { staffAddItems } from "./actions";
import { prisma as prismaImport } from "@/lib/prisma";
const prisma = prismaImport as any;

// Regression test for Phase 3.1: staff table-service order submission
// (order-panel.tsx -> staffAddItems -> addItemsForTable) silently dropped
// the retry-safety clientRequestId the customer flow already relies on, so
// a dropped-response retry from a staff device could create a duplicate
// order. Confirms staffAddItems now forwards it through unchanged.
describe("staffAddItems idempotency-key forwarding", () => {
  beforeEach(() => {
    requireStaffForSlug.mockReset();
    addItemsForTable.mockReset();
    getEntitlements.mockReset();
    vi.mocked(prisma.table.findFirst).mockReset();

    requireStaffForSlug.mockResolvedValue({
      staff: { id: "staff-1", role: "STAFF" },
      restaurant: { id: "rest-1", organizationId: "org-1", currency: "AUD" },
    });
    vi.mocked(prisma.table.findFirst).mockResolvedValue({ id: "table-1" });
    getEntitlements.mockResolvedValue({ ordering: true, orderingBlocked: false });
    addItemsForTable.mockResolvedValue({ ok: true });
  });

  it("forwards the same clientRequestId a retried submit would resend", async () => {
    await staffAddItems("venue", "table-1", [], "a note", "retry-key-123");

    expect(addItemsForTable).toHaveBeenCalledWith(
      expect.objectContaining({ tableId: "table-1" }),
      [],
      "STAFF",
      "a note",
      "retry-key-123",
    );
  });

  it("two identical retries with the same key both resolve ok — addItemsForTable's own idempotency check (unchanged) is what dedupes", async () => {
    const first = await staffAddItems("venue", "table-1", [{ menuItemId: "m1", quantity: 1 }], undefined, "key-1");
    const second = await staffAddItems("venue", "table-1", [{ menuItemId: "m1", quantity: 1 }], undefined, "key-1");

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(addItemsForTable).toHaveBeenNthCalledWith(1, expect.anything(), expect.anything(), "STAFF", undefined, "key-1");
    expect(addItemsForTable).toHaveBeenNthCalledWith(2, expect.anything(), expect.anything(), "STAFF", undefined, "key-1");
  });
});

// Security regression: Lite is menu-only (no live ordering at all) — staff
// must not be able to bypass that by adding items straight through the
// table-service endpoint. Previously only orderingBlocked (a lapsed PAID
// subscription) was checked here, so a Lite org — never blocked, never
// subscribed to anything to lapse — sailed straight through.
describe("staffAddItems refuses a Lite (no-ordering) plan", () => {
  beforeEach(() => {
    requireStaffForSlug.mockReset();
    addItemsForTable.mockReset();
    getEntitlements.mockReset();
    vi.mocked(prisma.table.findFirst).mockReset();

    requireStaffForSlug.mockResolvedValue({
      staff: { id: "staff-1", role: "STAFF" },
      restaurant: { id: "rest-1", organizationId: "org-1", currency: "AUD" },
    });
    vi.mocked(prisma.table.findFirst).mockResolvedValue({ id: "table-1" });
    getEntitlements.mockResolvedValue({ ordering: false, orderingBlocked: false });
  });

  it("refuses to add items when the plan has no ordering, even though orderingBlocked is false", async () => {
    const res = await staffAddItems("venue", "table-1", [{ menuItemId: "m1", quantity: 1 }]);

    expect(res).toEqual({ error: "Live ordering isn't included in this venue's plan." });
    expect(addItemsForTable).not.toHaveBeenCalled();
  });
});
