import { describe, it, expect, vi, beforeEach } from "vitest";

const { getAuthz, getOwnedTable, canCreateTable, getEntitlements } = vi.hoisted(() => ({
  getAuthz: vi.fn(),
  getOwnedTable: vi.fn(),
  canCreateTable: vi.fn(),
  getEntitlements: vi.fn(),
}));
vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prisma-mock");
  return { prisma: createPrismaMock() };
});
vi.mock("@/lib/auth", () => ({
  requireActiveLocation: vi.fn(),
  getOwnedTable,
  getAuthz,
}));
vi.mock("@/lib/entitlements", () => ({ canCreateTable, getEntitlements }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/tokens", () => ({ generateToken: vi.fn() }));
vi.mock("@/lib/stands", () => ({ activateStandBySerial: vi.fn() }));
vi.mock("@/lib/onboarding-options", () => ({ isFullyStaffedMode: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { setTableActive } from "./actions";
import { prisma as prismaImport } from "@/lib/prisma";
const prisma = prismaImport as any;

// Regression test for the table-limit deactivate/reactivate bypass:
// setTableActive checked permission and ent.ordering but never called
// canCreateTable, which only counts active:true tables anyway. On BASIC
// (25 tables): deactivate 5 -> create 5 new (count is back to 25, under the
// limit again) -> reactivate the 5 -> 30 active tables, repeatable
// indefinitely. Fixed by calling canCreateTable("reactivate") before any
// active: true update, while leaving deactivation (active: false) unchecked
// since it never grows the active count.
describe("setTableActive gates reactivation against the table limit", () => {
  beforeEach(() => {
    getAuthz.mockReset();
    getOwnedTable.mockReset();
    canCreateTable.mockReset();
    getEntitlements.mockReset();
    vi.mocked(prisma.table.update).mockReset();

    getAuthz.mockResolvedValue({
      can: () => true,
      membership: { organizationId: "org-1" },
      user: { id: "user-1", email: "owner@example.com" },
    });
    getEntitlements.mockResolvedValue({ ordering: true });
    getOwnedTable.mockResolvedValue({ id: "table-1", label: "12" });
  });

  it("refuses to REACTIVATE a table once the org is at its active-table limit", async () => {
    canCreateTable.mockResolvedValue({
      allowed: false,
      reason: "You're at your plan's limit of 25 active tables. Deactivate another table first, or upgrade.",
    });

    const res = await setTableActive("table-1", true);

    expect(res).toEqual({
      error: "You're at your plan's limit of 25 active tables. Deactivate another table first, or upgrade.",
    });
    expect(canCreateTable).toHaveBeenCalledWith("org-1", "reactivate");
    expect(prisma.table.update).not.toHaveBeenCalled();
  });

  it("allows reactivation when under the limit", async () => {
    canCreateTable.mockResolvedValue({ allowed: true });
    vi.mocked(prisma.table.update).mockResolvedValue({});

    const res = await setTableActive("table-1", true);

    expect(res).toEqual({});
    expect(prisma.table.update).toHaveBeenCalledWith({
      where: { id: "table-1" },
      data: { active: true },
    });
  });

  it("never checks the table limit when DEACTIVATING — that never grows the active count", async () => {
    vi.mocked(prisma.table.update).mockResolvedValue({});

    const res = await setTableActive("table-1", false);

    expect(res).toEqual({});
    expect(canCreateTable).not.toHaveBeenCalled();
    expect(prisma.table.update).toHaveBeenCalledWith({
      where: { id: "table-1" },
      data: { active: false },
    });
  });
});
