import { prisma } from "@/lib/prisma";

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
}): Promise<ChecklistItem[]> {
  const [tableCount, menuItemCount, staffAccountCount, orderCount] = await Promise.all([
    prisma.table.count({ where: { location: { restaurantId: restaurant.id } } }),
    prisma.menuItem.count({ where: { category: { restaurantId: restaurant.id } } }),
    prisma.staffAccount.count({ where: { restaurantId: restaurant.id, active: true } }),
    prisma.order.count({ where: { restaurantId: restaurant.id } }),
  ]);

  const mode = restaurant.experienceMode;
  const paymentFocused = mode === "payment_only";

  const menuItem: ChecklistItem = {
    id: "menu",
    label: "Build your menu",
    href: "/dashboard/menu",
    done: menuItemCount > 0,
  };
  const tablesItem: ChecklistItem = {
    id: "tables",
    label:
      tableCount > 0
        ? `${tableCount} table${tableCount === 1 ? "" : "s"} and QR codes generated`
        : "Create your tables",
    href: "/dashboard/tables",
    done: tableCount > 0,
  };
  const printItem: ChecklistItem | null =
    tableCount > 0
      ? { id: "print", label: "Print your table QR cards", href: "/dashboard/tables", done: false }
      : null;
  const staffItem: ChecklistItem = {
    id: "staff",
    label: "Create a staff PIN login",
    href: "/dashboard/staff-logins",
    done: staffAccountCount > 0,
  };
  const abnItem: ChecklistItem = {
    id: "abn",
    label: "Verify your business (ABN)",
    href: "/dashboard/settings/venue",
    done: !!restaurant.abnVerifiedAt,
  };

  const testItem: ChecklistItem =
    mode === "digital_menu"
      ? { id: "test", label: "Scan a table QR to preview your menu", href: "/dashboard/tables", done: orderCount > 0 }
      : mode === "payment_only"
        ? { id: "test", label: "Test paying a bill from your phone", href: "/dashboard/tables", done: orderCount > 0 }
        : { id: "test", label: "Place a test order from your phone", href: "/dashboard/tables", done: orderCount > 0 };

  const items = paymentFocused
    ? [tablesItem, printItem, menuItem, staffItem, abnItem, testItem]
    : [menuItem, tablesItem, printItem, staffItem, abnItem, testItem];

  return [
    { id: "venue", label: "Venue created", href: null, done: true },
    ...items.filter((i): i is ChecklistItem => i !== null),
  ];
}
