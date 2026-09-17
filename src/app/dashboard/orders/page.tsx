import Link from "next/link";
import { getAuthz } from "@/lib/auth";
import { getKitchenOrders, type OrderStatusName } from "@/lib/bills";
import { LiveRefresh } from "../live-refresh";
import { DashboardTicket } from "./dashboard-ticket";

export default async function OrdersPage() {
  const authz = await getAuthz();

  if (!authz.membership) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Orders
        </h1>
        <p className="text-muted">
          Create your restaurant first from the{" "}
          <Link href="/dashboard" className="text-pine hover:underline">
            Overview
          </Link>{" "}
          page.
        </p>
      </div>
    );
  }

  if (!authz.can("kitchen:manage")) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Orders
        </h1>
        <p className="text-muted">You don&apos;t have permission to view orders.</p>
      </div>
    );
  }

  const restaurant = authz.membership.organization.restaurants[0];
  const orders = restaurant ? await getKitchenOrders(restaurant.id) : [];
  const now = Date.now();

  const tickets = orders.map((o) => ({
    id: o.id,
    tableLabel: o.bill.table.label,
    status: o.status as OrderStatusName,
    source: o.source,
    minutesAgo: Math.floor((now - new Date(o.createdAt).getTime()) / 60000),
    items: o.items.map((it) => ({
      id: it.id,
      name: it.nameSnapshot,
      quantity: it.quantity,
      note: it.note,
    })),
  }));

  return (
    <div className="space-y-6">
      <LiveRefresh restaurantId={restaurant?.id ?? null} />
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Orders
        </h1>
        <p className="text-muted mt-1">
          Active kitchen tickets ({tickets.length}). Staff can also work these
          from the kitchen terminal.
        </p>
      </div>

      {tickets.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-8 text-center">
          <p className="text-muted">No active orders right now.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tickets.map((t) => (
            <DashboardTicket key={t.id} ticket={t} />
          ))}
        </div>
      )}
    </div>
  );
}
