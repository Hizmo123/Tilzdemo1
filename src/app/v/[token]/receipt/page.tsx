import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buildReceiptData } from "@/lib/receipts";
import { TaxInvoice } from "@/components/receipt/tax-invoice";
import { PrintButton } from "@/components/receipt/print-button";
import { EmailReceiptForm } from "@/components/receipt/email-receipt-form";
import { emailMyReceipt } from "../actions";

export const dynamic = "force-dynamic";

// Customer-facing receipt, reached from the payment success screen. Scoped by
// the opaque visit token (same capability model as ordering) — shows the most
// recent bill for that table.
export default async function CustomerReceiptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const qr = await prisma.qrToken.findUnique({
    where: { token },
    include: {
      table: { include: { location: { include: { restaurant: true } } } },
    },
  });

  if (!qr) {
    return (
      <Shell backHref="/">
        <p className="text-sm text-[#6b7169] text-center">
          This code isn&apos;t valid.
        </p>
      </Shell>
    );
  }

  const table = qr.table;
  const restaurant = table.location.restaurant;
  const location = table.location;

  const bill = await prisma.bill.findFirst({
    where: { tableId: table.id },
    orderBy: { createdAt: "desc" },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!bill || bill.items.length === 0) {
    return (
      <Shell backHref={`/v/${token}`}>
        <p className="text-sm text-[#6b7169] text-center">
          No bill to show yet.
        </p>
      </Shell>
    );
  }

  const data = buildReceiptData({
    restaurantName: restaurant.name,
    abn: restaurant.abn,
    locationName: location.name,
    addressLine: location.addressLine,
    suburb: location.suburb,
    state: location.state,
    postcode: location.postcode,
    tableLabel: table.label,
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

  return (
    <Shell backHref={`/v/${token}`}>
      <TaxInvoice data={data} />
      <div className="mt-4 flex flex-col items-center gap-3">
        <PrintButton />
        <EmailReceiptForm
          action={emailMyReceipt.bind(null, token)}
          initialEmail={bill.receiptEmail}
          sentAt={bill.receiptEmailSentAt?.toISOString() ?? null}
        />
      </div>
    </Shell>
  );
}

function Shell({
  children,
  backHref,
}: {
  children: React.ReactNode;
  backHref: string;
}) {
  return (
    <main className="min-h-dvh bg-[#f6f5f1] px-5 py-8 print:bg-white print:p-0">
      <div className="max-w-md mx-auto">
        <Link
          href={backHref}
          className="print:hidden text-sm text-[#6b7169] hover:text-[#15181b] mb-4 inline-block"
        >
          ← Back
        </Link>
        {children}
      </div>
    </main>
  );
}
