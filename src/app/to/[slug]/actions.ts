"use server";

import { createTakeawayOrder, type AddItem } from "@/lib/bills";

// Places a pickup/takeaway order. Anonymous like table ordering — the customer's
// name is what staff call out. Prices are decided server-side.
export async function placeTakeaway(
  slug: string,
  customerName: string,
  items: AddItem[],
  note?: string,
  clientRequestId?: string,
  customerPhone?: string,
) {
  return createTakeawayOrder(
    slug,
    customerName,
    items,
    note,
    clientRequestId,
    customerPhone,
  );
}
