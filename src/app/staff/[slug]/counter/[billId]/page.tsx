import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { requireStaffForSlug } from "@/lib/staff-auth";
import { roleCan } from "@/lib/rbac";
import { getCounterBillWithOrders, getMenuForCustomer } from "@/lib/bills";
import { formatCents } from "@/lib/money";
import { LiveRefresh } from "@/app/dashboard/live-refresh";
import { CounterOrderPanel } from "./counter-order-panel";
import { TakePaymentButton } from "./take-payment-button";

export const dynamic = "force-dynamic";

export default async function CounterSalePage({
  params,
}: {
  params: Promise<{ slug: string; billId: string }>;
}) {
  const { slug, billId } = await params;

  const session = await requireStaffForSlug(slug);
  if (!session) redirect(`/staff/${slug}`);

  const { staff, restaurant } = session;
  const currency = restaurant.currency;

  if (!roleCan(staff.role, "orders:manage")) {
    return (
      <main className="min-h-dvh bg-paper">
        <header className="border-b border-line bg-surface px-5 py-4 flex items-center gap-3">
          <Link href={`/staff/${slug}/counter`} className="text-sm text-muted hover:text-ink">
            ← Counter
          </Link>
          <span className="font-display text-lg font-semibold tracking-tight">Sale</span>
        </header>
        <p className="max-w-2xl mx-auto px-5 py-6 text-sm text-muted">
          Your role can&apos;t take orders.
        </p>
      </main>
    );
  }

  const [bill, menuRows] = await Promise.all([
    getCounterBillWithOrders(billId, restaurant.id),
    getMenuForCustomer(restaurant.id),
  ]);
  if (!bill) notFound();

  const remaining = bill.totalCents - bill.amountPaidCents;

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
          <Link href={`/staff/${slug}/counter`} className="text-sm text-muted hover:text-ink">
            ← Counter
          </Link>
          <span className="font-display text-lg font-semibold tracking-tight">
            Counter sale
          </span>
        </div>
        <span className="text-xs text-muted">{staff.name}</span>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-6">
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 mb-6">
          <h2 className="text-sm font-medium text-muted mb-3">Current sale</h2>
          {bill.items.length === 0 ? (
            <p className="text-sm text-muted">Nothing added yet.</p>
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
                <span className="tabular-nums">{formatCents(bill.totalCents, currency)}</span>
              </div>
            </>
          )}
          {remaining > 0 && (
            <TakePaymentButton
              slug={slug}
              billId={bill.id}
              remainingCents={remaining}
              currency={currency}
            />
          )}
        </div>

        <CounterOrderPanel slug={slug} billId={bill.id} currency={currency} menu={menu} />
      </div>
    </main>
  );
}
