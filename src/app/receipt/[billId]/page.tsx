import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildReceiptData } from "@/lib/receipts";
import { TaxInvoice } from "@/components/receipt/tax-invoice";
import { PrintButton } from "@/components/receipt/print-button";

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
    include: {
      items: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "asc" } },
      table: { include: { location: { include: { restaurant: true } } } },
    },
  });

  if (!bill) notFound();

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
        <div className="mt-4 flex justify-center">
          <PrintButton />
        </div>
      </div>
    </main>
  );
}
