import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prisma-mock");
  return { prisma: createPrismaMock() };
});

import { getInvoicesForExport, getInvoices } from "@/lib/invoices";
import { prisma as prismaImport } from "@/lib/prisma";
const prisma = prismaImport as any;

// This codebase has a documented history of bill queries scoping through
// `bill.table.location.restaurantId`, which silently excludes counter sales
// (Bill.tableId: null for those — see bills-counter-scoping.test.ts and the
// comment on dashboard/bills/page.tsx). The Leak 4 audit asked specifically
// whether the invoices export has the same bug. It does not: both
// getInvoicesForExport and getInvoices already filter on Bill.locationId
// directly (a real column, set for dine-in AND counter bills alike), never
// through the table relation. This test confirms — and pins — that both
// query on `locationId` as a top-level where clause, not nested under
// `table`, so a future refactor can't silently reintroduce the bug.
describe("invoices queries are location-scoped without excluding counter sales", () => {
  beforeEach(() => {
    vi.mocked(prisma.bill.findMany).mockReset().mockResolvedValue([]);
  });

  const range = { from: new Date("2026-01-01"), to: new Date("2026-02-01"), label: "test" };

  it("getInvoicesForExport filters on Bill.locationId directly, not bill.table.location", async () => {
    await getInvoicesForExport("loc-1", range);

    const call = vi.mocked(prisma.bill.findMany).mock.calls[0][0];
    expect(call.where.locationId).toBe("loc-1");
    expect(call.where.table).toBeUndefined();
  });

  it("getInvoices filters on Bill.locationId directly, not bill.table.location", async () => {
    await getInvoices("loc-1", range);

    const call = vi.mocked(prisma.bill.findMany).mock.calls[0][0];
    expect(call.where.locationId).toBe("loc-1");
    // table is only referenced (via OR) when a search term is given, and
    // even then it's an additional match clause, not the scoping clause.
    expect(call.where.table).toBeUndefined();
  });
});
