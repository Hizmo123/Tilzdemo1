"use server";

import {
  addItemsToBill,
  payBillAmount,
  payBillItems,
  cancelCustomerOrder,
  resolveVisit,
  type AddItem,
  type ItemSelection,
} from "@/lib/bills";
import { prisma } from "@/lib/prisma";
import { emailBillReceipt } from "@/lib/receipt-delivery";

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
// (clamped server-side). tipCents is charged on top and never affects the
// balance. mode is re-checked against the venue's splitMethods server-side —
// a hidden tab in the UI is presentation only, never the authority.
export async function payBill(
  token: string,
  amountCents: number | null,
  tipCents = 0,
  mode: "full" | "equal" | "custom" = "full",
) {
  return payBillAmount(token, amountCents, tipCents, mode);
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

// Emails a copy of the table's most recent bill (same bill the receipt page
// shows) to an address the guest provides. Token-scoped, same capability
// model as ordering — no login, just possession of the QR link.
export async function emailMyReceipt(token: string, email: string) {
  const resolved = await resolveVisit(token);
  if (!resolved.ok) return { error: "This table is no longer available." };

  const bill = await prisma.bill.findFirst({
    where: { tableId: resolved.visit.tableId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!bill) return { error: "No bill to send yet." };

  return emailBillReceipt(bill.id, email);
}
