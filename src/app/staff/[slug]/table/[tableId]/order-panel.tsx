"use client";

import { useRouter } from "next/navigation";
import { staffAddItems } from "./actions";
import { MenuOrderer, type OrderCategory } from "@/components/order/menu-orderer";

// Thin wrapper: staff take an order using the same menu/modifier/cart surface
// the customer uses, then the items land on the table's bill.
export function OrderPanel({
  slug,
  tableId,
  currency,
  menu,
  billTotalCents,
}: {
  slug: string;
  tableId: string;
  currency: string;
  menu: OrderCategory[];
  // The table's current bill total — shown in MenuOrderer's always-on
  // staff footer beside the send action.
  billTotalCents: number;
}) {
  const router = useRouter();

  async function onSubmit(
    lines: { menuItemId: string; quantity: number; optionIds: string[] }[],
    note?: string,
    clientRequestId?: string,
  ) {
    const res = await staffAddItems(slug, tableId, lines, note, clientRequestId);
    if (!("error" in res)) router.refresh();
    return res;
  }

  return (
    <div className="rounded-[var(--radius-card)] bg-surface shadow-float p-5">
      <h2 className="font-display text-lg font-semibold tracking-tight mb-3">
        Add to order
      </h2>
      <MenuOrderer
        menu={menu}
        currency={currency}
        density="staff"
        billTotalCents={billTotalCents}
        submitLabel={(n) => `Send ${n} ${n === 1 ? "item" : "items"} to the kitchen`}
        onSubmit={onSubmit}
      />
    </div>
  );
}
