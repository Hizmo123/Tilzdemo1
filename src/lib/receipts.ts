// GST maths for Australian tax invoices.
//
// Prices in Tillz are stored GST-INCLUSIVE (spec: AU menu prices include GST).
// GST is 10%, so for a tax-inclusive total the GST component is total / 11 and
// the ex-GST amount is the remainder. Everything stays in integer cents.
export const GST_DIVISOR = 11; // 1/11 of a GST-inclusive total is the GST.

export type GstBreakdown = {
  exGstCents: number;
  gstCents: number;
  totalCents: number;
};

export function gstBreakdown(totalCents: number): GstBreakdown {
  const gstCents = Math.round(totalCents / GST_DIVISOR);
  return { exGstCents: totalCents - gstCents, gstCents, totalCents };
}

// Format an ABN as "XX XXX XXX XXX" if it's 11 digits, else return as-is.
export function formatAbn(abn: string): string {
  const d = abn.replace(/\s+/g, "");
  if (!/^\d{11}$/.test(d)) return abn;
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8, 11)}`;
}

// The shape the TaxInvoice component renders. Built server-side from a bill.
export type ReceiptData = {
  restaurantName: string;
  abn: string | null;
  addressLines: string[];
  // null for a counter sale — the component renders "Counter" alone rather
  // than prefixing a table label that doesn't exist.
  tableLabel: string | null;
  currency: string;
  issuedAt: string; // ISO string; formatted in the component
  status: string;
  items: {
    name: string;
    quantity: number;
    lineTotalCents: number;
    modifiers: string[];
  }[];
  totalCents: number;
  amountPaidCents: number;
  tipCents: number;
  surchargeCents: number;
  refundedCents: number;
  payments: {
    provider: string;
    amountCents: number;
    tipCents: number;
    surchargeCents: number;
    refundedCents: number;
    test: boolean;
    createdAt: string;
  }[];
  anyTest: boolean;
};

// Build ReceiptData from a bill's fields. Kept free of Prisma types so it can be
// called from any server component with a plain shape.
export function buildReceiptData(input: {
  restaurantName: string;
  abn: string | null;
  locationName: string;
  addressLine: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  tableLabel: string | null;
  currency: string;
  createdAt: Date;
  paidAt: Date | null;
  status: string;
  items: {
    nameSnapshot: string;
    quantity: number;
    lineTotalCents: number;
    modifiers: unknown;
  }[];
  totalCents: number;
  amountPaidCents: number;
  tipCents: number;
  refundedCents: number;
  payments: {
    provider: string;
    amountCents: number;
    tipCents: number;
    surchargeCents: number;
    refundedCents: number;
    test: boolean;
    createdAt: Date;
  }[];
}): ReceiptData {
  const addressLines = [
    input.locationName,
    input.addressLine ?? "",
    [input.suburb, input.state, input.postcode].filter(Boolean).join(" "),
  ]
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return {
    restaurantName: input.restaurantName,
    abn: input.abn,
    addressLines,
    tableLabel: input.tableLabel,
    currency: input.currency,
    issuedAt: (input.paidAt ?? input.createdAt).toISOString(),
    status: input.status,
    items: input.items.map((it) => ({
      name: it.nameSnapshot,
      quantity: it.quantity,
      lineTotalCents: it.lineTotalCents,
      modifiers: Array.isArray(it.modifiers)
        ? (it.modifiers as { name?: string }[])
            .map((m) => m?.name ?? "")
            .filter((s) => s.length > 0)
        : [],
    })),
    totalCents: input.totalCents,
    amountPaidCents: input.amountPaidCents,
    tipCents: input.tipCents,
    surchargeCents: input.payments.reduce((sum, p) => sum + p.surchargeCents, 0),
    refundedCents: input.refundedCents,
    payments: input.payments.map((p) => ({
      provider: p.provider,
      amountCents: p.amountCents,
      tipCents: p.tipCents,
      surchargeCents: p.surchargeCents,
      refundedCents: p.refundedCents,
      test: p.test,
      createdAt: p.createdAt.toISOString(),
    })),
    anyTest: input.payments.some((p) => p.test),
  };
}
