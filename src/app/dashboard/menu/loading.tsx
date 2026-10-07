// Shown instantly on navigation to /dashboard/menu, before even the static
// header (which has no DB dependency beyond the layout's own cached lookup)
// has a chance to paint. MenuListData's own <Suspense fallback={MenuSkeleton}>
// (menu/page.tsx) still handles the actual query wait once the page itself
// mounts — this route-level skeleton only covers the gap before that.
export default function MenuLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-28 rounded-[var(--radius-sm)] bg-line/40" />
          <div className="h-4 w-40 rounded-[var(--radius-sm)] bg-line/40" />
        </div>
        <div className="h-9 w-36 rounded-[var(--radius-md)] bg-line/40" />
      </div>
      <div className="h-9 w-48 rounded-[var(--radius-sm)] bg-line/40" />
      <div className="h-11 rounded-[var(--radius-md)] bg-line/40" />
      <div className="h-64 rounded-[var(--radius-card)] bg-line/40" />
    </div>
  );
}
