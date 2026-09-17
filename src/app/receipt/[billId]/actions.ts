"use server";

import { revalidatePath } from "next/cache";
import { getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emailBillReceipt } from "@/lib/receipt-delivery";
import { refundBillPayment } from "@/lib/bills";
import { audit } from "@/lib/audit";

// Owner/staff re-sending a copy of a bill's receipt. Scoped to a bill the
// signed-in user's org owns — same check as the page itself.
export async function emailReceiptCopy(billId: string, email: string) {
  const { user } = await getAuthz();

  const bill = await prisma.bill.findFirst({
    where: {
      id: billId,
      table: {
        location: {
          restaurant: {
            organization: { memberships: { some: { userId: user.id } } },
          },
        },
      },
    },
    select: { id: true },
  });
  if (!bill) return { error: "Bill not found." };

  return emailBillReceipt(bill.id, email);
}

// Refunds a specific payment on this bill, full or partial. Gated on
// payments:refund (owner/admin/manager, not general staff) and scoped to a
// bill the signed-in user's org owns.
export async function refundPaymentAction(
  billId: string,
  paymentId: string,
  amountCents: number,
  reason: string,
) {
  const authz = await getAuthz();
  if (!authz.can("payments:refund")) return { error: "Not permitted." };

  const bill = await prisma.bill.findFirst({
    where: {
      id: billId,
      table: {
        location: {
          restaurant: {
            organization: { memberships: { some: { userId: authz.user.id } } },
          },
        },
      },
    },
    include: { table: { include: { location: { include: { restaurant: true } } } } },
  });
  if (!bill) return { error: "Bill not found." };

  const restaurant = bill.table.location.restaurant;
  const res = await refundBillPayment(paymentId, restaurant.id, amountCents, reason, {
    userId: authz.user.id,
    email: authz.user.email ?? "",
  });
  if ("error" in res) return res;

  await audit({
    organizationId: restaurant.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "payment.refunded",
    resourceType: "Payment",
    resourceId: paymentId,
    metadata: { amountCents, reason, billId },
  });

  revalidatePath(`/receipt/${billId}`);
  revalidatePath("/dashboard/bills");
  return { ok: true as const };
}
