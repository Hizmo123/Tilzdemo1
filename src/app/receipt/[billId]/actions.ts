"use server";

import { revalidatePath } from "next/cache";
import { getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emailBillReceipt } from "@/lib/receipt-delivery";
import { refundBillPayment } from "@/lib/bills";
import { audit } from "@/lib/audit";

// Owner/staff re-sending a copy of a bill's receipt. Distinct from
// v/[token]/actions.ts#emailMyReceipt — that one is the CUSTOMER path,
// authenticated by possessing the table's token, and is untouched by this
// fix. This one previously had no permission check at all (unlike its
// sibling refundPaymentAction below): any authenticated dashboard user could
// call it, and — combined with the "any org" scoping bug just below —
// against ANY org's bill, not just their own. Gated on "bills:view": the
// exact permission that already gates seeing this bill/page at all (every
// role that can reach /receipt/[billId] holds it), so this can't email a
// bill the caller couldn't otherwise already view.
export async function emailReceiptCopy(billId: string, email: string) {
  const authz = await getAuthz();
  if (!authz.can("bills:view")) return { error: "Not permitted." };
  if (!authz.membership) return { error: "No organization found." };
  const organizationId = authz.membership.organizationId;

  // Scoped by organizationId — the SAME membership's org the permission
  // check above applies to — never "any org this user belongs to." See
  // getAuthz()'s doc comment in lib/auth.ts.
  const bill = await prisma.bill.findFirst({
    where: {
      id: billId,
      // OR: a dine-in bill reaches its org via table -> location -> restaurant;
      // a counter bill has no table, so it's scoped via Bill.restaurantId
      // directly instead (see prisma schema's Bill.restaurantId comment).
      OR: [
        {
          table: {
            location: {
              restaurant: { organizationId },
            },
          },
        },
        {
          restaurant: { organizationId },
        },
      ],
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
  if (!authz.membership) return { error: "No organization found." };
  const organizationId = authz.membership.organizationId;

  // Scoped by organizationId — the SAME membership's org the permission
  // check above applies to — never "any org this user belongs to." See
  // getAuthz()'s doc comment in lib/auth.ts.
  const bill = await prisma.bill.findFirst({
    where: {
      id: billId,
      OR: [
        {
          table: {
            location: {
              restaurant: { organizationId },
            },
          },
        },
        {
          restaurant: { organizationId },
        },
      ],
    },
    include: {
      table: { include: { location: { include: { restaurant: true } } } },
      restaurant: true,
    },
  });
  if (!bill) return { error: "Bill not found." };

  const restaurant = bill.table?.location.restaurant ?? bill.restaurant;
  if (!restaurant) return { error: "Bill not found." };
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
