import { requirePlatformAdmin } from "@/lib/platform-admin";
import { listFulfilmentOrders } from "@/lib/admin/queries";
import { formatCents } from "@/lib/money";
import { StatusButtons } from "./status-buttons";

type ShippingAddress = {
  line1: string;
  line2?: string;
  suburb: string;
  state: string;
  postcode: string;
};

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
          {orders.map((order) => {
            const addr = order.shippingAddress as ShippingAddress | null;
            return (
              <div
                key={order.id}
                className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-medium">
                      {order.organizationName} · {order.restaurantName}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {order.quantity} stand{order.quantity === 1 ? "" : "s"} ·{" "}
                      {formatCents(order.amountCents)} · paid{" "}
                      {order.paidAt ? new Date(order.paidAt).toLocaleDateString("en-AU") : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
                        order.status === "SHIPPED"
                          ? "bg-pine-soft text-pine-deep"
                          : order.status === "PRINTED"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {order.status}
                    </span>
                    <a
                      href={`/admin/fulfilment/${order.id}/qr-pack`}
                      className="text-xs rounded-md border border-line px-2.5 py-1.5 hover:border-ink/30"
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
                      {order.stands.map((s) => `Table ${s.table?.label ?? "?"} (${s.serial})`).join(", ")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-1">Ship to</p>
                    {addr ? (
                      <p>
                        {addr.line1}
                        {addr.line2 ? `, ${addr.line2}` : ""}, {addr.suburb} {addr.state}{" "}
                        {addr.postcode}
                      </p>
                    ) : (
                      <p className="text-muted">No address recorded.</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
