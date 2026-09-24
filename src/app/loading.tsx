export default function Loading() {
  return (
    <div className="min-h-dvh bg-paper flex items-center justify-center">
      <div className="flex items-center gap-3 text-muted">
        <span className="w-4 h-4 rounded-pill border-2 border-line border-t-pine animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    </div>
  );
}
