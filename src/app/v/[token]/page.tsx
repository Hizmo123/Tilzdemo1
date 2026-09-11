import {
  resolveVisit,
  getMenuForCustomer,
  getOpenBillWithItems,
} from "@/lib/bills";
import { prisma } from "@/lib/prisma";
import { isOpenNow, isWithinWindow, parseHours } from "@/lib/hours";
import { CustomerExperience } from "./customer-experience";

// Public, no-auth landing reached by scanning a table QR. Resolves the opaque
// token to a table without exposing internal ids, then hands the customer the
// menu + running bill. Development build — payments are mock only (spec §93).
export const dynamic = "force-dynamic";

const INVALID_COPY: Record<string, { title: string; message: string }> = {
  not_found: {
    title: "Code not recognised",
    message: "This QR code isn't valid. It may have been mistyped or replaced.",
  },
  code_revoked: {
    title: "Code no longer active",
    message:
      "This QR code has been replaced. Please scan the current code on your table.",
  },
  table_inactive: {
    title: "Table unavailable",
    message: "This table isn't taking orders right now.",
  },
};

function InvalidState({ reason }: { reason: string }) {
  const copy = INVALID_COPY[reason] ?? INVALID_COPY.not_found;
  return (
    <main className="min-h-dvh bg-paper flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-danger-soft text-danger flex items-center justify-center mx-auto mb-4 text-xl">
          !
        </div>
        <h1 className="font-display text-xl font-semibold tracking-tight">
          {copy.title}
        </h1>
        <p className="text-sm text-muted mt-2">{copy.message}</p>
        <p className="text-xs text-muted mt-6">
          Please ask a staff member for help.
        </p>
      </div>
    </main>
  );
}

export default async function VisitPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolved = await resolveVisit(token);

  if (!resolved.ok) return <InvalidState reason={resolved.reason} />;

  const { visit } = resolved;
  const [menuRows, billRow] = await Promise.all([
    getMenuForCustomer(visit.restaurantId),
    getOpenBillWithItems(visit.tableId),
  ]);

  const open = isOpenNow(parseHours(visit.hours), visit.timezone);

  // Map to plain, minimal shapes for the client boundary. Categories outside
  // their availability window (e.g. a breakfast menu after 11am) are hidden.
  const menu = menuRows
    .filter((c) => isWithinWindow(c.availableFrom, c.availableTo, visit.timezone))
    .map((c) => ({
    id: c.id,
    name: c.name,
    items: c.items.map((i) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      priceCents: i.priceCents,
      available: i.available,
      imageUrl: i.imageUrl,
      allergens: i.allergens,
      groups: i.modifierGroups.map((g) => ({
        id: g.id,
        name: g.name,
        required: g.required,
        maxSelect: g.maxSelect,
        options: g.options.map((o) => ({
          id: o.id,
          name: o.name,
          priceDeltaCents: o.priceDeltaCents,
        })),
      })),
    })),
  }));

  const bill = billRow
    ? {
        items: billRow.items
          .filter((it) => !it.voided)
          .map((it) => ({
            id: it.id,
            nameSnapshot: it.nameSnapshot,
            unitPriceCents: it.comped ? 0 : it.unitPriceCents,
            quantity: it.quantity,
            paidQuantity: it.comped ? it.quantity : it.paidQuantity,
            lineTotalCents: it.comped ? 0 : it.lineTotalCents,
            modifiers: (it.modifiers as { name: string }[] | null) ?? null,
          })),
        subtotalCents: billRow.subtotalCents,
        totalCents: billRow.totalCents,
        amountPaidCents: billRow.amountPaidCents,
      }
    : null;

  // Live status of the table's current orders, so the customer sees progress.
  const orderStatuses = billRow
    ? (
        await prisma.order.findMany({
          where: { billId: billRow.id, status: { not: "CANCELLED" } },
          orderBy: { createdAt: "asc" },
          include: { items: { select: { nameSnapshot: true, quantity: true } } },
        })
      ).map((o) => ({
        id: o.id,
        // Surface a payment-held order distinctly so the customer knows to pay.
        status:
          o.status === "PENDING" && o.awaitingPayment && !o.awaitingApproval
            ? "AWAITING_PAYMENT"
            : (o.status as string),
        orderNumber: o.orderNumber,
        items: o.items.map((i) => `${i.quantity}× ${i.nameSnapshot}`),
      }))
    : [];

  return (
    <CustomerExperience
      token={token}
      restaurantName={visit.restaurantName}
      locationName={visit.locationName}
      tableLabel={visit.tableLabel}
      currency={visit.currency}
      logoUrl={visit.logoUrl}
      coverUrl={visit.coverUrl}
      bgImageUrl={visit.bgImageUrl}
      brandColor={visit.brandColor}
      theme={visit.theme}
      themeMode={visit.themeMode}
      fontTheme={visit.fontTheme}
      paymentTiming={visit.paymentTiming}
      tipEnabled={visit.tipEnabled}
      tipPresets={visit.tipPresets}
      open={open}
      canOrder={visit.customerOrdering && open}
      canPay={visit.customerPayment}
      orders={orderStatuses}
      menu={menu}
      bill={bill}
    />
  );
}
