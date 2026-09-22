import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthz, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildReceiptData } from "@/lib/receipts";
import { TaxInvoice } from "@/components/receipt/tax-invoice";
import { PrintButton } from "@/components/receipt/print-button";
import { EmailReceiptForm } from "@/components/receipt/email-receipt-form";
import { RefundPanel } from "@/components/payments/refund-panel";
import { emailReceiptCopy, refundPaymentAction } from "./actions";

export const dynamic = "force-dynamic";

// Owner/staff reprint. Top-level route (not under /dashboard) so the printout
// carries no sidebar chrome. Scoped to a bill the signed-in user's org owns.
export default async function OwnerReceiptPage({
  params,
}: {
  params: Promise<{ billId: string }>;
}) {
  const { billId } = await params;
  const user = await requireUser();
  const authz = await getAuthz();

  const bill = await prisma.bill.findFirst({
    where: {
      id: billId,
      OR: [
        {
          table: {
            location: {
              restaurant: {
                organization: { memberships: { some: { userId: user.id } } },
              },
            },
          },
        },
        {
          restaurant: {
            organization: { memberships: { some: { userId: user.id } } },
          },
        },
      ],
    },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "asc" } },
      table: { include: { location: { include: { restaurant: true } } } },
      restaurant: true,
      location: true,
    },
  });

  if (!bill) notFound();

  const restaurant = bill.table?.location.restaurant ?? bill.restaurant;
  const location = bill.table?.location ?? bill.location;
  if (!restaurant || !location) notFound();

  const data = buildReceiptData({
    restaurantName: restaurant.name,
    abn: restaurant.abn,
    locationName: location.name,
    addressLine: location.addressLine,
    suburb: location.suburb,
    state: location.state,
    postcode: location.postcode,
    tableLabel: bill.table?.label ?? null,
    currency: bill.currency,
    createdAt: bill.createdAt,
    paidAt: bill.paidAt,
    status: bill.status,
    items: bill.items,
    totalCents: bill.totalCents,
    amountPaidCents: bill.amountPaidCents,
    refundedCents: bill.refundedCents,
    tipCents: bill.tipCents,
    payments: bill.payments,
  });

  return (
    <main className="min-h-dvh bg-[#f6f5f1] px-5 py-8 print:bg-white print:p-0">
      <div className="max-w-md mx-auto">
        <Link
          href="/dashboard/bills"
          className="print:hidden text-sm text-[#6b7169] hover:text-[#15181b] mb-4 inline-block"
        >
          ← Bills
        </Link>
        <TaxInvoice data={data} />
        <div className="mt-4 flex justify-center items-center gap-3 print:hidden">
          <PrintButton />
          <EmailReceiptForm
            action={emailReceiptCopy.bind(null, bill.id)}
            initialEmail={bill.receiptEmail}
            sentAt={bill.receiptEmailSentAt?.toISOString() ?? null}
          />
        </div>
        {authz.can("payments:refund") && (
          <div className="mt-4 print:hidden">
            <RefundPanel
              payments={bill.payments
                .filter((p) => p.status === "SUCCEEDED")
                .map((p) => ({
                  id: p.id,
                  // Number(...): RefundPanel is a CLIENT component — a
                  // bigint here would fail to serialise across the server/
                  // client boundary entirely, not just fail at render.
                  // amountCents etc. are plain Prisma Int columns today, but
                  // this is the actual crossing point for a Square-connected
                  // bill's payment row, so it's coerced defensively here too
                  // (same reasoning as buildReceiptData in lib/receipts.ts).
                  amountCents: Number(p.amountCents),
                  tipCents: Number(p.tipCents),
                  surchargeCents: Number(p.surchargeCents),
                  refundedCents: Number(p.refundedCents),
                  currency: p.currency,
                  provider: p.provider,
                  test: p.test,
                  createdAt: p.createdAt.toISOString(),
                }))}
              onRefund={(paymentId, amountCents, reason) =>
                refundPaymentAction(bill.id, paymentId, amountCents, reason)
              }
            />
          </div>
        )}
      </div>
    </main>
  );
}
