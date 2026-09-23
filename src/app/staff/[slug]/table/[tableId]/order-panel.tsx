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
}: {
  slug: string;
  tableId: string;
  currency: string;
  menu: OrderCategory[];
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
    <div>
      <h2 className="font-display text-lg font-semibold tracking-tight mb-3">
        Add to order
      </h2>
      <MenuOrderer
        menu={menu}
        currency={currency}
        submitLabel={(n) => `Send ${n} ${n === 1 ? "item" : "items"} to the bill`}
        onSubmit={onSubmit}
      />
    </div>
  );
}
