"use server";

import {
  addItemsToBill,
  payBillAmount,
  payBillItems,
  cancelCustomerOrder,
  setBillContact,
  type AddItem,
  type ItemSelection,
} from "@/lib/bills";

// Customer actions are intentionally unauthenticated: the customer is anonymous
// (spec §33, §83). Possession of the opaque token in the URL is the capability
// that authorises acting on that table's bill, and every price/amount is decided
// server-side from the DB — the client only names item ids and quantities, and
// proposes a payment amount that the server clamps to the outstanding balance.

export async function addItems(
  token: string,
  items: AddItem[],
  note?: string,
  clientRequestId?: string,
) {
  return addItemsToBill(token, items, note, clientRequestId);
}

// amountCents = null pays the full remaining balance; a number pays that much
// (clamped server-side). tipCents is charged on top and never affects the balance.
export async function payBill(
  token: string,
  amountCents: number | null,
  tipCents = 0,
) {
  return payBillAmount(token, amountCents, tipCents);
}

// Pay for chosen units of the bill (per-person item split).
export async function payItems(
  token: string,
  selections: ItemSelection[],
  tipCents = 0,
) {
  return payBillItems(token, selections, tipCents);
}

// Cancel an order placed by mistake, while the kitchen hasn't started it.
export async function cancelOrder(token: string, orderId: string) {
  return cancelCustomerOrder(token, orderId);
}

// Save a mobile for an "order ready" text.
export async function saveContact(token: string, phone: string) {
  return setBillContact(token, phone);
}
