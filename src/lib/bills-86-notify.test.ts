import { describe, it, expect, vi, beforeEach } from "vitest";

const { notifyRestaurant } = vi.hoisted(() => ({ notifyRestaurant: vi.fn() }));

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prisma-mock");
  return { prisma: createPrismaMock() };
});
vi.mock("@/lib/realtime", () => ({ notifyRestaurant }));

import { setMenuItemAvailable } from "@/lib/bills";
import { prisma as prismaImport } from "@/lib/prisma";
const prisma = prismaImport as any;

// Regression test for Phase 3.3: 86'ing an item (setMenuItemAvailable, used
// by the kitchen board's "86" button) updated the DB but never called
// notifyRestaurant — a waiter mid-order on that item, or another kitchen
// screen, only found out on their next unrelated poll.
describe("setMenuItemAvailable realtime notification", () => {
  beforeEach(() => {
    notifyRestaurant.mockReset();
    vi.mocked(prisma.menuItem.findFirst).mockReset();
    vi.mocked(prisma.menuItem.update).mockReset();
  });

  it("notifies the restaurant after marking an item unavailable", async () => {
    vi.mocked(prisma.menuItem.findFirst).mockResolvedValue({ id: "item-1" });
    vi.mocked(prisma.menuItem.update).mockResolvedValue({});

    const res = await setMenuItemAvailable("item-1", "rest-1", false);

    expect(res).toEqual({ ok: true });
    expect(notifyRestaurant).toHaveBeenCalledWith("rest-1");
  });

  it("does not notify when the item isn't found (nothing changed)", async () => {
    vi.mocked(prisma.menuItem.findFirst).mockResolvedValue(null);

    await setMenuItemAvailable("missing", "rest-1", false);

    expect(notifyRestaurant).not.toHaveBeenCalled();
  });
});
