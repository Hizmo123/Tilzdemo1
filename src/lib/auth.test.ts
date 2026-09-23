import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prisma-mock");
  return { prisma: createPrismaMock() };
});

import { getOwnedTable } from "@/lib/auth";
import { prisma as prismaImport } from "@/lib/prisma";
const prisma = prismaImport as any;

// Regression test for the cross-org privilege-escalation fix: getOwnedTable
// must scope strictly by the CALLER'S organizationId, never by "any org this
// user happens to belong to." Simulates a real DB filter (the auto-mock
// itself doesn't implement `where` logic) so the test actually exercises
// getOwnedTable's query shape, not just that some function was called.
describe("getOwnedTable", () => {
  const tables = [
    { id: "table-a", organizationId: "org-a" },
    { id: "table-b", organizationId: "org-b" },
  ];

  beforeEach(() => {
    vi.mocked(prisma.table.findFirst).mockReset();
    vi.mocked(prisma.table.findFirst).mockImplementation(
      async (args: { where: { id: string; location: { restaurant: { organizationId: string } } } }) => {
        const row = tables.find(
          (t) => t.id === args.where.id && t.organizationId === args.where.location.restaurant.organizationId,
        );
        return row ?? null;
      },
    );
  });

  it("resolves a table that belongs to the caller's own org", async () => {
    const result = await getOwnedTable("org-a", "table-a");
    expect(result).not.toBeNull();
  });

  it("an OWNER on org A cannot reach a table that belongs to org B, even though they might separately hold a membership there", async () => {
    // Simulates: user is OWNER on org-a (that's the role getAuthz() resolved),
    // but tries to act against org-b's table-b. The caller always passes
    // THEIR OWN membership's organizationId (org-a here) — never table-b's —
    // so this must resolve to null, not silently succeed because the user
    // also happens to have SOME membership on org-b.
    const result = await getOwnedTable("org-a", "table-b");
    expect(result).toBeNull();
  });
});
