import { prisma } from "@/lib/prisma";
import { isFullyStaffedMode } from "@/lib/onboarding-options";

export type ChecklistItem = {
  id: string;
  label: string;
  href: string | null;
  done: boolean;
};

// Derives the dashboard's post-onboarding checklist live from real data —
// nothing is a persisted "I did this" flag, so it can never drift from what's
// actually true, and it naturally stays hidden forever once everything it
// checks is genuinely done.
export async function getSetupChecklist(restaurant: {
  id: string;
  slug: string;
  experienceMode: string | null;
  abnVerifiedAt: Date | null;
  customerOrdering: boolean;
  customerPayment: boolean;
  useSharedQr: boolean;
  qrStandSourcing: string | null;
}): Promise<ChecklistItem[]> {
  const [tableCount, menuItemCount, staffAccountCount, orderCount] = await Promise.all([
    prisma.table.count({ where: { location: { restaurantId: restaurant.id } } }),
    prisma.menuItem.count({ where: { category: { restaurantId: restaurant.id } } }),
    prisma.staffAccount.count({ where: { restaurantId: restaurant.id, active: true } }),
    prisma.order.count({ where: { restaurantId: restaurant.id } }),
  ]);

  const mode = restaurant.experienceMode;
  const paymentFocused = mode === "payment_only";
  // Staff take orders AND handle payment — this venue never has a customer
  // scan a table QR (isFullyStaffedMode), whether the preset was "Digital
  // menu" or an equivalent Custom combination. useSharedQr is the owner's
  // choice (see dashboard/settings/venue-setup/actions.ts) to actually lead
  // with the one shared QR rather than whatever per-table codes it still
  // has from before.
  const fullyStaffed = isFullyStaffedMode(restaurant.customerOrdering, restaurant.customerPayment);
  const usesSharedQr = fullyStaffed && restaurant.useSharedQr;

  const menuItem: ChecklistItem = {
    id: "menu",
    label: "Build your menu",
    href: "/dashboard/menu",
    done: menuItemCount > 0,
  };
  // Neither makes sense once this venue is on the shared QR — there's
  // nothing per-table to create or print, and pointing at Tables here would
  // be exactly the stale guidance this mode exists to avoid.
  const tablesItem: ChecklistItem | null = usesSharedQr
    ? null
    : {
        id: "tables",
        label:
          tableCount > 0
            ? `${tableCount} table${tableCount === 1 ? "" : "s"} and QR codes generated`
            : "Create your tables",
        href: "/dashboard/tables",
        done: tableCount > 0,
      };
  // "Order your stands" only for those who chose the Tillz ordering path in
  // onboarding (or later chose it — see dashboard/stands); everyone else
  // (DIY, or unanswered) gets the existing "print your own" reminder, same
  // as before this field existed.
  const printItem: ChecklistItem | null =
    !usesSharedQr && tableCount > 0 && restaurant.qrStandSourcing !== "ordered_from_tillz"
      ? { id: "print", label: "Print your table QR cards", href: "/dashboard/tables", done: false }
      : null;
  const orderStandsItem: ChecklistItem | null =
    !usesSharedQr && tableCount > 0 && restaurant.qrStandSourcing === "ordered_from_tillz"
      ? { id: "order-stands", label: "Order your stands", href: "/dashboard/stands", done: false }
      : null;
  const staffItem: ChecklistItem = {
    id: "staff",
    label: "Create a staff PIN login",
    href: "/dashboard/staff/logins",
    done: staffAccountCount > 0,
  };
  const abnItem: ChecklistItem = {
    id: "abn",
    label: "Verify your business (ABN)",
    href: "/dashboard/settings/venue",
    done: !!restaurant.abnVerifiedAt,
  };

  const testHref = usesSharedQr ? "/dashboard" : "/dashboard/tables";
  const testItem: ChecklistItem = fullyStaffed
    ? {
        id: "test",
        label: paymentFocused ? "Test paying a bill from your phone" : "Scan your QR to preview your menu",
        href: testHref,
        done: orderCount > 0,
      }
    : { id: "test", label: "Place a test order from your phone", href: testHref, done: orderCount > 0 };

  const items = paymentFocused
    ? [tablesItem, printItem, orderStandsItem, menuItem, staffItem, abnItem, testItem]
    : [menuItem, tablesItem, printItem, orderStandsItem, staffItem, abnItem, testItem];

  return [
    { id: "venue", label: "Venue created", href: null, done: true },
    ...items.filter((i): i is ChecklistItem => i !== null),
  ];
}
