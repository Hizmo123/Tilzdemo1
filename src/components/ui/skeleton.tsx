// Shimmering placeholder for content that's still loading. Sized by the
// caller (className) so it mirrors the shape it stands in for — a loading
// state should look like the page, not like a spinner.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton rounded-[var(--radius-sm)] ${className}`} />;
}

// Menu-shaped skeleton: a chip row and a few item cards, so the layout
// doesn't jump when the real menu arrives.
export function MenuSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Skeleton className="h-10 w-16 rounded-pill" />
        <Skeleton className="h-10 w-24 rounded-pill" />
        <Skeleton className="h-10 w-20 rounded-pill" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-20 w-20 shrink-0 rounded-[var(--radius-md)]" />
          <div className="flex-1 space-y-2 pt-1">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-4 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}
