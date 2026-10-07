// Shown instantly on navigation to /dashboard while the page's own data
// fetch (DashboardHome's Promise.all) is still in flight — this page has no
// internal Suspense streaming of its own, so without this the nav click sat
// on a blank area until everything resolved. Same skeleton tokens as menu's
// existing MenuSkeleton (dashboard/menu/page.tsx): bg-line/40 + animate-pulse.
export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded-[var(--radius-sm)] bg-line/40" />
          <div className="h-4 w-64 rounded-[var(--radius-sm)] bg-line/40" />
        </div>
      </div>
      <div className="h-16 rounded-[var(--radius-card)] bg-line/40" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 rounded-[var(--radius-card)] bg-line/40" />
        ))}
      </div>
      <div className="h-48 rounded-[var(--radius-card)] bg-line/40" />
    </div>
  );
}
