import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ordersCreate = vi.fn();
const paymentsCreate = vi.fn();

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prisma-mock");
  return { prisma: createPrismaMock() };
});
vi.mock("@/lib/realtime", () => ({ notifyRestaurant: vi.fn() }));
vi.mock("@/lib/log", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/square/client", () => ({
  squareClientFor: vi.fn(async () => ({
    orders: { create: ordersCreate },
    payments: { create: paymentsCreate },
  })),
}));
vi.mock("@/lib/env", () => ({
  env: {
    squareApplicationId: () => "app-id",
    squareEnv: () => "sandbox",
  },
}));

import { payBillAmount, payBillItems } from "@/lib/bills";
import { prisma as prismaImport } from "@/lib/prisma";
const prisma = prismaImport as any;

// Same fixture shape as bills-app-fee-persistence.test.ts — resolveVisit
// (lib/bills.ts) destructures this exact qrToken.findUnique result.
// BASIC with no SquareConnection row -> getVenuePaymentContext resolves
// "mock" mode, the path this whole file is about.
function qrFixture(splitMethods: string[]) {
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
          splitMethods,
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
            plan: "BASIC",
            subscriptionLapsedAt: null,
            connectPlusEnabled: false,
            connectBrandingHidden: false,
          },
        },
      },
    },
  };
}

const openBillForAmount = {
  id: "bill-1",
  tableId: "table-1",
  currency: "AUD",
  totalCents: 1000,
  amountPaidCents: 0,
  status: "OPEN",
  items: [],
};

const openBillForItems = {
  id: "bill-2",
  tableId: "table-1",
  currency: "AUD",
  totalCents: 1000,
  amountPaidCents: 0,
  status: "OPEN",
  items: [
    {
      id: "item-1",
      quantity: 1,
      paidQuantity: 0,
      unitPriceCents: 1000,
      voided: false,
      comped: false,
    },
  ],
};

describe("mock payments blocked on a genuinely live deployment", () => {
  beforeEach(() => {
    ordersCreate.mockReset();
    paymentsCreate.mockReset();
    vi.mocked(prisma.squareConnection.findUnique).mockReset().mockResolvedValue(null);
    vi.mocked(prisma.bill.updateMany).mockReset().mockResolvedValue({ count: 1 });
    vi.mocked(prisma.bill.update).mockReset().mockResolvedValue({});
    vi.mocked(prisma.payment.create).mockReset().mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("payBillAmount", () => {
    beforeEach(() => {
      vi.mocked(prisma.qrToken.findUnique).mockReset().mockResolvedValue(qrFixture(["full", "custom"]));
      vi.mocked(prisma.bill.findFirst).mockReset().mockResolvedValue(openBillForAmount);
    });

    it("is blocked when NODE_ENV and SQUARE_ENV are both production, and releases the reserve", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("SQUARE_ENV", "production");

      const res = await payBillAmount("tok-1", 300, 0, "custom");

      expect(res).toEqual({ error: "Online payment isn't available at this venue yet. Please pay at the counter." });
      expect(ordersCreate).not.toHaveBeenCalled();
      expect(paymentsCreate).not.toHaveBeenCalled();
      expect(prisma.payment.create).not.toHaveBeenCalled();
      // The reserve CAS bumped amountPaidCents to 300 — this must release it
      // back to the pre-reserve 0, or the bill is left falsely part-paid.
      expect(prisma.bill.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: "bill-1", amountPaidCents: 300 }),
          data: expect.objectContaining({ amountPaidCents: 0, status: "OPEN" }),
        }),
      );
    });

    it("is allowed when NODE_ENV is production but SQUARE_ENV is not", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("SQUARE_ENV", "sandbox");

      const res = await payBillAmount("tok-1", 300, 0, "custom");

      expect(res).toMatchObject({ paid: true, amountPaidCents: 300 });
      expect(prisma.payment.create).toHaveBeenCalledTimes(1);
    });

    it("is allowed when neither NODE_ENV nor SQUARE_ENV is production (local/dev)", async () => {
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("SQUARE_ENV", "sandbox");

      const res = await payBillAmount("tok-1", 300, 0, "custom");

      expect(res).toMatchObject({ paid: true, amountPaidCents: 300 });
    });

    it("is allowed even in production when ALLOW_MOCK_PAYMENTS=true (explicit override)", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("SQUARE_ENV", "production");
      vi.stubEnv("ALLOW_MOCK_PAYMENTS", "true");

      const res = await payBillAmount("tok-1", 300, 0, "custom");

      expect(res).toMatchObject({ paid: true, amountPaidCents: 300 });
      expect(prisma.payment.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("payBillItems", () => {
    beforeEach(() => {
      vi.mocked(prisma.qrToken.findUnique).mockReset().mockResolvedValue(qrFixture(["items"]));
      vi.mocked(prisma.bill.findFirst).mockReset().mockResolvedValue(openBillForItems);
      vi.mocked(prisma.billItem.updateMany).mockReset().mockResolvedValue({ count: 1 });
    });

    it("is blocked when NODE_ENV and SQUARE_ENV are both production, and releases both the bill and item reserves", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("SQUARE_ENV", "production");

      const res = await payBillItems("tok-1", [{ billItemId: "item-1", count: 1 }]);

      expect(res).toEqual({ error: "Online payment isn't available at this venue yet. Please pay at the counter." });
      expect(paymentsCreate).not.toHaveBeenCalled();
      expect(prisma.payment.create).not.toHaveBeenCalled();
      // releaseItemsReserve reverts the bill row...
      expect(prisma.bill.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: "bill-2", amountPaidCents: 1000 }),
          data: expect.objectContaining({ amountPaidCents: 0, status: "OPEN" }),
        }),
      );
      // ...and the per-item paidQuantity bump.
      expect(prisma.billItem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: "item-1", paidQuantity: 1 }),
          data: expect.objectContaining({ paidQuantity: 0 }),
        }),
      );
    });

    it("is allowed outside a genuinely live deployment", async () => {
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("SQUARE_ENV", "sandbox");

      const res = await payBillItems("tok-1", [{ billItemId: "item-1", count: 1 }]);

      expect(res).toMatchObject({ paid: true });
      expect(prisma.payment.create).toHaveBeenCalledTimes(1);
    });

    it("is allowed in production with ALLOW_MOCK_PAYMENTS=true", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("SQUARE_ENV", "production");
      vi.stubEnv("ALLOW_MOCK_PAYMENTS", "true");

      const res = await payBillItems("tok-1", [{ billItemId: "item-1", count: 1 }]);

      expect(res).toMatchObject({ paid: true });
    });
  });
});
