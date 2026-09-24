import { requirePlatformAdmin } from "@/lib/platform-admin";
import { listFulfilmentOrders } from "@/lib/admin/queries";
import { formatCents } from "@/lib/money";
import { StatusButtons } from "./status-buttons";

export default async function FulfilmentPage() {
  await requirePlatformAdmin();

  const orders = await listFulfilmentOrders();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Stand fulfilment
        </h1>
        <p className="text-muted mt-1">
          Paid orders, unshipped first ({orders.length}).
        </p>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-muted">No orders to fulfil right now.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div
              key={order.id}
              className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-medium">
                    {order.organization.name} · {order.restaurant.name}
                  </p>
                  <p className="text-sm mt-0.5">
                    {order.quantity}× {order.productType ?? ""}{" "}
                    {order.productTitleSnapshot ?? "(product unknown)"} — Tables{" "}
                    {order.items.map((i) => i.table.label).join(", ")}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {formatCents(order.totalCents)} · paid{" "}
                    {order.paidAt
                      ? new Date(order.paidAt).toLocaleDateString("en-AU")
                      : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-[var(--radius-xs)] ${
                      order.status === "SHIPPED"
                        ? "bg-pine-soft text-pine-deep"
                        : order.status === "PRINTED"
                          ? "bg-info-soft text-info"
                          : "bg-warn-soft text-warn"
                    }`}
                  >
                    {order.status}
                  </span>
                  <a
                    href={`/admin/fulfilment/${order.id}/qr-pack`}
                    className="text-xs rounded-[var(--radius-xs)] border border-line px-2.5 py-1.5 hover:border-ink/30"
                  >
                    Download QR pack
                  </a>
                  <StatusButtons orderId={order.id} status={order.status} />
                </div>
              </div>

              <div className="mt-3 grid sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted mb-1">Tables</p>
                  <p>
                    {order.items
                      .map(
                        (i) =>
                          `Table ${i.table.label} (${i.stand?.serial ?? "not minted"})`,
                      )
                      .join(", ")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted mb-1">Ship to</p>
                  <p>
                    {order.shippingName} — {order.shippingAddress},{" "}
                    {order.shippingSuburb} {order.shippingState}{" "}
                    {order.shippingPostcode}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
