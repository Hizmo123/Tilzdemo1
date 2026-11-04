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
import { z } from "zod";
import { limitActionByIp } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { emailBillReceipt } from "@/lib/receipt-delivery";

// Customer actions are intentionally unauthenticated: the customer is anonymous
// (spec §33, §83). Possession of the opaque token in the URL is the capability
// that authorises acting on that table's bill, and every price/amount is decided
// server-side from the DB — the client only names item ids and quantities, and
// proposes a payment amount that the server clamps to the outstanding balance.

const tokenSchema = z.string().min(8).max(128);
const idSchema = z.string().min(1).max(64);
const centsSchema = z.number().int().min(0).max(10_000_000);
const itemsSchema = z
  .array(
    z.object({
      menuItemId: idSchema,
      quantity: z.number().int().min(1).max(99),
      optionIds: z.array(idSchema).max(50).optional(),
      note: z.string().max(300).optional(),
    }),
  )
  .min(1)
  .max(100);
const selectionsSchema = z
  .array(z.object({ billItemId: idSchema, count: z.number().int().min(1).max(99) }))
  .min(1)
  .max(100);
const INVALID = { error: "Invalid request." };

export async function addItems(
  token: string,
  items: AddItem[],
  note?: string,
  clientRequestId?: string,
) {
  if (!tokenSchema.safeParse(token).success || !itemsSchema.safeParse(items).success) return INVALID;
  if (note !== undefined && (typeof note !== "string" || note.length > 500)) return INVALID;
  if (clientRequestId !== undefined && (typeof clientRequestId !== "string" || clientRequestId.length > 100)) return INVALID;
  const limited = await limitActionByIp("order", 30, 5 * 60_000);
  if (limited) return { error: limited };
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
  // Web Payments SDK card token (Phase 3) — only meaningful on a
  // Square-connected venue; the mock path ignores it.
  sourceId?: string,
) {
  if (
    !tokenSchema.safeParse(token).success ||
    !(amountCents === null || centsSchema.safeParse(amountCents).success) ||
    !centsSchema.safeParse(tipCents).success ||
    !["full", "equal", "custom"].includes(mode) ||
    (sourceId !== undefined && (typeof sourceId !== "string" || sourceId.length > 500))
  )
    return INVALID;
  const limited = await limitActionByIp("pay", 20, 5 * 60_000);
  if (limited) return { error: limited };
  return payBillAmount(token, amountCents, tipCents, mode, sourceId);
}

// Pay for chosen units of the bill (per-person item split).
export async function payItems(
  token: string,
  selections: ItemSelection[],
  tipCents = 0,
  sourceId?: string,
) {
  if (
    !tokenSchema.safeParse(token).success ||
    !selectionsSchema.safeParse(selections).success ||
    !centsSchema.safeParse(tipCents).success ||
    (sourceId !== undefined && (typeof sourceId !== "string" || sourceId.length > 500))
  )
    return INVALID;
  const limited = await limitActionByIp("pay", 20, 5 * 60_000);
  if (limited) return { error: limited };
  return payBillItems(token, selections, tipCents, sourceId);
}

// Cancel an order placed by mistake, while the kitchen hasn't started it.
export async function cancelOrder(token: string, orderId: string) {
  if (!tokenSchema.safeParse(token).success || !idSchema.safeParse(orderId).success) return INVALID;
  return cancelCustomerOrder(token, orderId);
}

// Emails a copy of the table's most recent bill (same bill the receipt page
// shows) to an address the guest provides. Token-scoped, same capability
// model as ordering — no login, just possession of the QR link.
export async function emailMyReceipt(token: string, email: string) {
  if (!tokenSchema.safeParse(token).success || !z.string().email().max(254).safeParse(email).success)
    return { error: "Enter a valid email address." };
  const limited = await limitActionByIp("receipt-email", 5, 10 * 60_000);
  if (limited) return { error: limited };
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

// Fire-and-forget tap counter for the "Leave a Google review" button on the
// paid screen — one Int column on Restaurant (googleReviewClicks), same
// simple counter-on-model pattern as orderSeq. No per-guest row, no event
// table: we only ever need "how many taps, all time," never who or when.
// Token-scoped like every other customer action; re-resolves the visit
// rather than trusting a restaurantId from the client.
export async function clickGoogleReview(token: string) {
  const resolved = await resolveVisit(token);
  if (!resolved.ok) return;

  await prisma.restaurant.update({
    where: { id: resolved.visit.restaurantId },
    data: { googleReviewClicks: { increment: 1 } },
  });
}
