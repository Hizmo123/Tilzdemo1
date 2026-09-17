import { prisma } from "@/lib/prisma";
import { buildReceiptData } from "@/lib/receipts";
import { buildReceiptEmail } from "@/lib/receipt-email";
import { sendEmail } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Emails a copy of a bill's tax invoice and records who it was sent to. The
// caller is responsible for authorization (a customer's token scoping them to
// their own table, or an owner's org-membership check) — this function only
// assumes billId is already a bill the caller is allowed to see.
export async function emailBillReceipt(
  billId: string,
  email: string,
): Promise<{ ok: true } | { error: string }> {
  const trimmed = email.trim();
  if (!EMAIL_RE.test(trimmed)) return { error: "Enter a valid email address." };

  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "asc" } },
      table: { include: { location: { include: { restaurant: true } } } },
    },
  });
  if (!bill) return { error: "Bill not found." };
  if (bill.items.length === 0) return { error: "Nothing to send yet." };

  const restaurant = bill.table.location.restaurant;
  const location = bill.table.location;

  const data = buildReceiptData({
    restaurantName: restaurant.name,
    abn: restaurant.abn,
    locationName: location.name,
    addressLine: location.addressLine,
    suburb: location.suburb,
    state: location.state,
    postcode: location.postcode,
    tableLabel: bill.table.label,
    currency: bill.currency,
    createdAt: bill.createdAt,
    paidAt: bill.paidAt,
    status: bill.status,
    items: bill.items,
    totalCents: bill.totalCents,
    amountPaidCents: bill.amountPaidCents,
    tipCents: bill.tipCents,
    refundedCents: bill.refundedCents,
    payments: bill.payments,
  });

  const { subject, html, text } = buildReceiptEmail(data);
  const result = await sendEmail({ to: trimmed, subject, html, text });
  if (!result.ok) {
    return { error: result.error ?? "Couldn't send that email. Please try again." };
  }

  await prisma.bill.update({
    where: { id: bill.id },
    data: { receiptEmail: trimmed, receiptEmailSentAt: new Date() },
  });

  return { ok: true };
}
