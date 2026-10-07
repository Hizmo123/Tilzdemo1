// Shown instantly on navigation to /dashboard/staff while StaffPage's own
// data fetch (membership + staffInvite) is still in flight. Same skeleton
// tokens as menu's existing MenuSkeleton: bg-line/40 + animate-pulse.
export default function StaffLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-20 rounded-[var(--radius-sm)] bg-line/40" />
        <div className="h-4 w-64 rounded-[var(--radius-sm)] bg-line/40" />
      </div>
      <div className="h-9 w-56 rounded-[var(--radius-sm)] bg-line/40" />
      <div className="h-80 rounded-[var(--radius-card)] bg-line/40" />
    </div>
  );
}
