"use client";

import { useTour } from "./tour-provider";

// Low-key "Replay tour" entry point. Works from any dashboard page: start()
// navigates to the first step's page itself. Ignores the completed flag by
// design — replaying is always allowed.
export function ReplayTourButton({ className = "" }: { className?: string }) {
  const { start, active } = useTour();
  return (
    <button
      type="button"
      onClick={start}
      disabled={active}
      className={`inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors duration-[var(--dur-fast)] disabled:opacity-50 ${className}`}
    >
      <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 10a6 6 0 1 1 1.8 4.3" />
        <path d="M4 15v-4h4" />
      </svg>
      Replay tour
    </button>
  );
}
