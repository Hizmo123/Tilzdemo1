"use client";

// Root error boundary. Never shows a raw stack to the user (spec §59) — a
// friendly message plus a short reference derived from the error digest that
// support can match to server logs.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const ref = (error.digest ?? Math.random().toString(36).slice(2, 8))
    .toString()
    .slice(0, 6)
    .toUpperCase();

  return (
    <main className="min-h-dvh bg-paper flex items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center">
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p className="text-sm text-muted mt-2">
          We hit an unexpected error. Please try again.
        </p>
        <button
          onClick={reset}
          className="mt-5 rounded-[var(--radius-sm)] bg-ink text-surface px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          Try again
        </button>
        <p className="text-xs text-muted mt-6">
          If it keeps happening, quote reference{" "}
          <span className="font-mono">#{ref}</span>
        </p>
      </div>
    </main>
  );
}
