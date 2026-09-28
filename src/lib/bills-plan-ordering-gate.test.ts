import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prisma-mock");
  return { prisma: createPrismaMock() };
});
vi.mock("@/lib/realtime", () => ({ notifyRestaurant: vi.fn() }));
vi.mock("@/lib/log", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { addItemsToBill } from "@/lib/bills";
import { prisma as prismaImport } from "@/lib/prisma";
const prisma = prismaImport as any;

// A full qrToken.findUnique fixture, shaped exactly like resolveVisit's own
// include (lib/bills.ts) — every field it destructures off `r` (the
// restaurant) needs a value or the real function throws before the gate
// under test ever runs.
function qrFixture(overrides: { plan: string; subscriptionLapsedAt: Date | null }) {
  return {
    active: true,
    table: {
      id: "table-1",
      label: "5",
      section: null,
      active: true,
      location: {
        name: "Main",
        restaurant: {
          id: "rest-1",
          name: "Test Venue",
          published: true,
          currency: "AUD",
          timezone: "Australia/Sydney",
          hours: null,
          logoUrl: null,
          coverUrl: null,
          bgImageUrl: null,
          brandColor: null,
          theme: "warm",
          themeMode: "light",
          fontTheme: "classic",
          cornerStyle: "rounded",
          tagline: null,
          menuLayout: "grid",
          instagramHandle: null,
          websiteUrl: null,
          tipEnabled: false,
          tipPresets: [5, 10, 15],
          customerOrdering: true,
          customerPayment: true,
          staffApproval: false,
          paymentTiming: "after",
          requirePaymentBeforeOrder: false,
          splitMethods: ["full"],
          surchargeEnabled: false,
          surchargeBasisPoints: 0,
          cardStyle: null,
          typeScale: "md",
          sectionHeaderStyle: "plain",
          buttonShape: "pill",
          buttonFill: "solid",
          bgTreatment: "none",
          bgPatternKey: null,
          bgOverlayStrength: 0,
          qrForegroundColor: null,
          qrBackgroundColor: null,
          qrCornerStyle: "square",
          qrEmbedLogo: false,
          organization: {
            plan: overrides.plan,
            subscriptionLapsedAt: overrides.subscriptionLapsedAt,
            connectPlusEnabled: false,
            connectBrandingHidden: false,
          },
        },
      },
    },
  };
}

// Regression test for the LITE-forever-ordering leak: addItemsToBill was
// the only server-side gate on a customer placing an order, and it only
// checked orderingBlocked (lapsed-subscription grace period) — never
// ent.ordering. A LITE org (which never included ordering at all, so
// nothing "lapses") could subscribe, set up tables, downgrade to LITE, and
// customers would keep ordering forever. Fixed by resolveVisit surfacing
// planAllowsOrdering and addItemsToBill checking it before orderingBlocked.
describe("addItemsToBill checks planAllowsOrdering", () => {
  beforeEach(() => {
    vi.mocked(prisma.qrToken.findUnique).mockReset();
    vi.mocked(prisma.squareConnection.findUnique).mockReset().mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockClear();
  });

  it("rejects a LITE org's order before ever reaching the transaction, without naming the plan", async () => {
    vi.mocked(prisma.qrToken.findUnique).mockResolvedValue(
      qrFixture({ plan: "LITE", subscriptionLapsedAt: null }),
    );

    const res = await addItemsToBill("tok-1", [{ menuItemId: "m1", quantity: 1 }]);

    expect(res).toEqual({ error: "This venue isn't taking orders through Tillz right now." });
    expect(JSON.stringify(res)).not.toMatch(/lite/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("a paying tier (BASIC, not lapsed) passes the plan gate and proceeds to attempt the order", async () => {
    vi.mocked(prisma.qrToken.findUnique).mockResolvedValue(
      qrFixture({ plan: "BASIC", subscriptionLapsedAt: null }),
    );
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("boom-past-gate"));

    await expect(
      addItemsToBill("tok-2", [{ menuItemId: "m1", quantity: 1 }]),
    ).rejects.toThrow("boom-past-gate");
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("a BASIC org lapsed well past the 7-day grace period still gets orderingBlocked's message, not the LITE one", async () => {
    const longLapsed = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    vi.mocked(prisma.qrToken.findUnique).mockResolvedValue(
      qrFixture({ plan: "BASIC", subscriptionLapsedAt: longLapsed }),
    );

    const res = await addItemsToBill("tok-3", [{ menuItemId: "m1", quantity: 1 }]);

    expect(res).toEqual({
      error: "This venue can't take new orders right now. Please ask a staff member.",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
