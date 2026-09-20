"use client";

import { useRouter } from "next/navigation";
import { addCounterItems } from "../actions";
import { MenuOrderer, type OrderCategory } from "@/components/order/menu-orderer";

// Same wrapper shape as the table order flow's OrderPanel — the customer/
// staff menu surface is identical, only the destination action differs
// (items land on a counter bill instead of a table's bill).
export function CounterOrderPanel({
  slug,
  billId,
  currency,
  menu,
}: {
  slug: string;
  billId: string;
  currency: string;
  menu: OrderCategory[];
}) {
  const router = useRouter();

  async function onSubmit(
    lines: { menuItemId: string; quantity: number; optionIds: string[] }[],
  ) {
    const res = await addCounterItems(slug, billId, lines);
    if (!("error" in res)) router.refresh();
    return res;
  }

  return (
    <div>
      <h2 className="font-display text-lg font-semibold tracking-tight mb-3">
        Add to sale
      </h2>
      <MenuOrderer
        menu={menu}
        currency={currency}
        submitLabel={(n) => `Add ${n} ${n === 1 ? "item" : "items"} to the sale`}
        onSubmit={onSubmit}
      />
    </div>
  );
}
