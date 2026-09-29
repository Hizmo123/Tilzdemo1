import { describe, it, expect, vi, beforeEach } from "vitest";

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

import { payBillAmount } from "@/lib/bills";
import { prisma as prismaImport } from "@/lib/prisma";
const prisma = prismaImport as any;

// Regression coverage for persisting Payment.appFeeCents (nullable, added
// alongside computeAppFeeCents — see lib/square/pay.ts). The column is
// intentionally never backfilled; these tests only cover NEW charges.
//
// Full qrToken.findUnique fixture — same shape resolveVisit (lib/bills.ts)
// destructures, as established in bills-plan-ordering-gate.test.ts.
function qrFixture(plan: "CONNECT" | "BASIC") {
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
          splitMethods: ["full", "custom"],
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
            plan,
            subscriptionLapsedAt: null,
            connectPlusEnabled: false,
            connectBrandingHidden: false,
          },
        },
      },
    },
  };
}

const openBill = {
  id: "bill-1",
  tableId: "table-1",
  currency: "AUD",
  totalCents: 1000,
  amountPaidCents: 0,
  status: "OPEN",
  items: [],
};

describe("Payment.appFeeCents persistence", () => {
  beforeEach(() => {
    ordersCreate.mockReset();
    paymentsCreate.mockReset();
    vi.mocked(prisma.qrToken.findUnique).mockReset();
    vi.mocked(prisma.squareConnection.findUnique).mockReset();
    vi.mocked(prisma.bill.findFirst).mockReset().mockResolvedValue(openBill);
    vi.mocked(prisma.bill.updateMany).mockReset().mockResolvedValue({ count: 1 });
    vi.mocked(prisma.bill.update).mockReset().mockResolvedValue({});
    vi.mocked(prisma.payment.create).mockReset().mockResolvedValue({});
  });

  it("a Connect-org Square charge stores Payment.appFeeCents as the exact cents sent to Square", async () => {
    vi.mocked(prisma.qrToken.findUnique).mockResolvedValue(qrFixture("CONNECT"));
    vi.mocked(prisma.squareConnection.findUnique).mockResolvedValue({
      locationId: "sq-loc-1",
      revokedAt: null,
    });
    ordersCreate.mockResolvedValue({ order: { id: "order-1", totalMoney: { amount: BigInt(300) } } });
    paymentsCreate.mockResolvedValue({ payment: { id: "payment-1", status: "COMPLETED" } });

    const res = await payBillAmount("tok-1", 300, 0, "custom", "src-1");

    expect(res).toMatchObject({ paid: true, amountPaidCents: 300 });
    expect(prisma.payment.create).toHaveBeenCalledTimes(1);
    const data = vi.mocked(prisma.payment.create).mock.calls[0][0].data;
    // 300c * 150bps / 10000 = 4.5c -> rounds to 5c — the exact figure sent
    // to Square as appFeeMoney in this same call (see paymentsCreate below).
    expect(data.appFeeCents).toBe(5);
    const squareCall = paymentsCreate.mock.calls[0][0];
    expect(squareCall.appFeeMoney).toEqual({ amount: BigInt(5), currency: "AUD" });
  });

  it("a Connect-org charge too small to round to a nonzero fee stores appFeeCents: 0 (still recorded, not null)", async () => {
    vi.mocked(prisma.qrToken.findUnique).mockResolvedValue(qrFixture("CONNECT"));
    vi.mocked(prisma.squareConnection.findUnique).mockResolvedValue({
      locationId: "sq-loc-1",
      revokedAt: null,
    });
    // 1c * 150bps / 10000 = 0.015c -> rounds to 0.
    ordersCreate.mockResolvedValue({ order: { id: "order-2", totalMoney: { amount: BigInt(1) } } });
    paymentsCreate.mockResolvedValue({ payment: { id: "payment-2", status: "COMPLETED" } });

    await payBillAmount("tok-1", 1, 0, "custom", "src-1");

    const data = vi.mocked(prisma.payment.create).mock.calls[0][0].data;
    expect(data.appFeeCents).toBe(0);
    expect(data.appFeeCents).not.toBeNull();
    // And Square never received an appFeeMoney key at all for this charge.
    const squareCall = paymentsCreate.mock.calls[0][0];
    expect("appFeeMoney" in squareCall).toBe(false);
  });

  it("a non-Connect (mock-provider) payment stores appFeeCents: null — there is no Tillz app fee outside Square/Connect", async () => {
    vi.mocked(prisma.qrToken.findUnique).mockResolvedValue(qrFixture("BASIC"));
    // No Square connection at all for this venue -> getVenuePaymentContext
    // resolves "mock" mode, the mock provider path.
    vi.mocked(prisma.squareConnection.findUnique).mockResolvedValue(null);

    const res = await payBillAmount("tok-1", 300, 0, "custom");

    expect(res).toMatchObject({ paid: true, amountPaidCents: 300 });
    expect(ordersCreate).not.toHaveBeenCalled();
    const data = vi.mocked(prisma.payment.create).mock.calls[0][0].data;
    expect(data.appFeeCents).toBeNull();
  });
});
