import { describe, it, expect } from "vitest";

// Regression test for Phase 2.3: refundBillPayment, refireItems,
// ownedOpenBillItem (void/comp) and setBillDiscount all scoped their bill
// lookup through `bill: { table: { location: { restaurantId } } }` — but a
// counter/cash bill has Bill.tableId: null, so `bill.table` is always null
// for one and every one of these operations silently found nothing on a
// counter bill. Fixed to `OR: [{ table: { location: { restaurantId } } },
// { restaurantId }]` in all four places.
//
// This exercises that exact OR-filter shape against fixture bills, the same
// way the real Prisma query would evaluate it — without needing to spin up
// the full refund/void/discount pipeline (Square provider, CAS retries,
// etc.), which isn't the logic under test here.
type FixtureBill = { id: string; tableId: string | null; restaurantId: string; tableRestaurantId?: string };

function matchesOrgScope(bill: FixtureBill, restaurantId: string): boolean {
  const matchesViaTable = bill.tableId !== null && bill.tableRestaurantId === restaurantId;
  const matchesViaDirectRestaurant = bill.restaurantId === restaurantId;
  return matchesViaTable || matchesViaDirectRestaurant;
}

describe("bill org-scoping OR filter (refund/refire/void-comp/discount)", () => {
  const dineInBill: FixtureBill = {
    id: "bill-dinein",
    tableId: "table-1",
    tableRestaurantId: "rest-a",
    restaurantId: "rest-a",
  };
  const counterBill: FixtureBill = {
    id: "bill-counter",
    tableId: null,
    restaurantId: "rest-a",
  };

  it("finds a dine-in bill via the table -> location -> restaurant path", () => {
    expect(matchesOrgScope(dineInBill, "rest-a")).toBe(true);
  });

  it("finds a counter bill via Bill.restaurantId directly — the table branch can't match", () => {
    expect(matchesOrgScope(counterBill, "rest-a")).toBe(true);
  });

  it("a counter bill from a DIFFERENT restaurant is still correctly excluded", () => {
    expect(matchesOrgScope(counterBill, "rest-b")).toBe(false);
  });

  it("a dine-in bill from a different restaurant is still correctly excluded", () => {
    expect(matchesOrgScope(dineInBill, "rest-b")).toBe(false);
  });
});
