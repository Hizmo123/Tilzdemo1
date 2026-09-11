import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-dvh bg-paper flex items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center">
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="text-sm text-muted mt-2">
          That page doesn&apos;t exist or has moved.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-lg border border-line px-4 py-2 text-sm font-medium hover:border-ink/30"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
