// Shown instantly on navigation to /dashboard/orders while OrdersPage's own
// data fetch (getKitchenOrders + getOrderHistory) is still in flight — this
// page has no internal Suspense streaming of its own. Same skeleton tokens
// as menu's existing MenuSkeleton: bg-line/40 + animate-pulse.
export default function OrdersLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-32 rounded-[var(--radius-sm)] bg-line/40" />
        <div className="h-4 w-72 rounded-[var(--radius-sm)] bg-line/40" />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-32 rounded-[var(--radius-card)] bg-line/40" />
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-6 w-24 rounded-[var(--radius-sm)] bg-line/40" />
        <div className="h-64 rounded-[var(--radius-card)] bg-line/40" />
      </div>
    </div>
  );
}
