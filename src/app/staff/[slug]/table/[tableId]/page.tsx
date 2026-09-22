import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { requireStaffForSlug, requireStaffOrdering } from "@/lib/staff-auth";
import { roleCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getMenuForCustomer, getOpenBillWithItems } from "@/lib/bills";
import { formatCents } from "@/lib/money";
import { LiveRefresh } from "@/app/dashboard/live-refresh";
import { OrderPanel } from "./order-panel";
import { MarkPaidButton } from "./mark-paid-button";
import { BillEditor } from "./bill-editor";
import { TableTransfer } from "./table-transfer";
import { RefundPanel } from "@/components/payments/refund-panel";
import { staffRefundPayment } from "./actions";

export const dynamic = "force-dynamic";

export default async function StaffTablePage({
  params,
}: {
  params: Promise<{ slug: string; tableId: string }>;
}) {
  const { slug, tableId } = await params;

  const session = await requireStaffForSlug(slug);
  if (!session) redirect(`/staff/${slug}`);
  // HARD guard: LITE has no live ordering to run any of this against — see
  // lib/staff-auth.ts#requireStaffOrdering for why this is NOT
  // lib/auth.ts#requireOrdering (owner Supabase session vs staff PIN session).
  await requireStaffOrdering(session.restaurant.organizationId, slug);

  const { staff, restaurant } = session;
  const currency = restaurant.currency;

  const table = await prisma.table.findFirst({
    where: {
      id: tableId,
      location: { restaurantId: restaurant.id },
    },
  });
  if (!table) notFound();

  const canOrder = roleCan(staff.role, "orders:manage");
  const canRefund = roleCan(staff.role, "payments:refund");

  const otherTablesQuery = prisma.table.findMany({
    where: {
      id: { not: table.id },
      active: true,
      location: { restaurantId: restaurant.id },
    },
    orderBy: [{ section: "asc" }, { createdAt: "asc" }],
    include: {
      bills: {
        where: { status: { in: ["OPEN", "PARTIALLY_PAID"] } },
        take: 1,
        select: { id: true },
      },
    },
  });

  const [bill, menuRows, otherTables] = await Promise.all([
    getOpenBillWithItems(table.id),
    getMenuForCustomer(restaurant.id),
    canOrder ? otherTablesQuery : Promise.resolve([] as Awaited<typeof otherTablesQuery>),
  ]);

  // Refunds here are scoped to the table's current bill only — reaching back
  // into a table's whole payment history belongs on the bill view
  // (/receipt/[billId], linked from Bills in the dashboard), not this screen.
  const payments =
    canRefund && bill
      ? await prisma.payment.findMany({
          where: { billId: bill.id, status: "SUCCEEDED" },
          orderBy: { createdAt: "asc" },
        })
      : [];

  const remaining = bill ? bill.totalCents - bill.amountPaidCents : 0;
  const transferTargets = otherTables.map((t) => ({
    id: t.id,
    label: t.label,
    section: t.section,
    hasOpenBill: t.bills.length > 0,
  }));

  const menu = menuRows.map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    items: c.items.map((i) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      priceCents: i.priceCents,
      available: i.available,
      imageUrl: i.imageUrl,
      allergens: i.allergens,
      badges: i.badges,
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

  return (
    <main className="min-h-dvh bg-paper">
      <LiveRefresh seconds={5} restaurantId={restaurant.id} />
      <header className="border-b border-line bg-surface px-5 py-4 sticky top-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/staff/${slug}/home`} className="text-sm text-muted hover:text-ink">
            ← Tables
          </Link>
          <span className="font-display text-lg font-semibold tracking-tight">
            Table {table.label}
          </span>
        </div>
        <span className="text-xs text-muted">{staff.name}</span>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-6">
        {/* Current bill */}
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 mb-6">
          <h2 className="text-sm font-medium text-muted mb-3">Current bill</h2>
          {!bill || bill.items.length === 0 ? (
            <p className="text-sm text-muted">Nothing ordered yet.</p>
          ) : canOrder ? (
            <BillEditor
              slug={slug}
              tableId={table.id}
              billId={bill.id}
              currency={currency}
              items={bill.items.map((it) => ({
                id: it.id,
                nameSnapshot: it.nameSnapshot,
                quantity: it.quantity,
                lineTotalCents: it.lineTotalCents,
                voided: it.voided,
                comped: it.comped,
                modifiers: Array.isArray(it.modifiers)
                  ? (it.modifiers as { name: string }[])
                  : null,
              }))}
              subtotalCents={bill.subtotalCents}
              discountCents={bill.discountCents}
              totalCents={bill.totalCents}
              remainingCents={remaining}
            />
          ) : (
            <>
              <ul className="space-y-2">
                {bill.items
                  .filter((it) => !it.voided)
                  .map((it) => (
                    <li key={it.id} className="flex justify-between text-sm gap-3">
                      <span className="min-w-0">
                        {it.quantity > 1 && (
                          <span className="text-muted">{it.quantity}× </span>
                        )}
                        {it.nameSnapshot}
                      </span>
                      <span className="tabular-nums shrink-0">
                        {formatCents(it.lineTotalCents, currency)}
                      </span>
                    </li>
                  ))}
              </ul>
              <div className="border-t border-line mt-3 pt-3 flex justify-between font-medium">
                <span>Total</span>
                <span className="tabular-nums">
                  {formatCents(bill.totalCents, currency)}
                </span>
              </div>
            </>
          )}
          {bill && remaining > 0 && canOrder && (
            <MarkPaidButton
              slug={slug}
              tableId={table.id}
              remainingCents={remaining}
              currency={currency}
            />
          )}
          {bill && canOrder && (
            <TableTransfer slug={slug} billId={bill.id} targets={transferTargets} />
          )}
          {bill && canRefund && payments.length > 0 && (
            <RefundPanel
              payments={payments.map((p) => ({
                id: p.id,
                amountCents: p.amountCents,
                tipCents: p.tipCents,
                surchargeCents: p.surchargeCents,
                refundedCents: p.refundedCents,
                currency: p.currency,
                provider: p.provider,
                test: p.test,
                createdAt: p.createdAt.toISOString(),
              }))}
              // Bound Server Action, not an inline closure — see the same
              // comment on the owner receipt page's RefundPanel usage for
              // why (Next.js refuses to pass a plain function/closure to a
              // Client Component prop).
              action={staffRefundPayment.bind(null, slug, table.id)}
            />
          )}
        </div>

        {canOrder ? (
          <OrderPanel
            slug={slug}
            tableId={table.id}
            currency={currency}
            menu={menu}
          />
        ) : (
          <p className="text-sm text-muted">
            Your role can view this table but not take orders.
          </p>
        )}
      </div>
    </main>
  );
}
