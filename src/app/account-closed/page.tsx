import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button-classes";
import { ACCOUNT_RETENTION_YEARS } from "@/lib/account-retention";

// Where the deletion flow lands (privacy-data-section.tsx hard-navigates
// here). Public and static on purpose: the visitor was just signed out and
// their dashboard is gone, so it must not depend on a session, an
// organisation, or anything the deletion removed.
export const metadata: Metadata = {
  title: "Account closed",
  robots: { index: false, follow: false },
};

export default function AccountClosedPage() {
  return (
    <main className="min-h-dvh bg-paper flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-surface shadow-raised p-8 text-center">
        <div
          aria-hidden
          className="w-12 h-12 rounded-pill bg-pine-soft text-pine-deep flex items-center justify-center mx-auto mb-4"
        >
          <svg viewBox="0 0 20 20" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 10.5l3.5 3.5L16 6" />
          </svg>
        </div>
        <h1 className="font-display text-xl font-semibold tracking-tight">Your account has been closed</h1>
        <p className="text-sm text-muted mt-2">
          Everything on your Tillz account has been closed and your subscription cancelled. We&apos;ve emailed you a
          confirmation.
        </p>
        <p className="text-xs text-muted mt-3">
          Payment and refund records are kept privately for {ACCOUNT_RETENTION_YEARS} years as Australian law requires,
          then permanently deleted.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <Link href="/" className={buttonClasses("primary", "md", true)}>
            Back to Tillz
          </Link>
          <Link href="/support" className={buttonClasses("secondary", "md", true)}>
            Contact support
          </Link>
        </div>
      </div>
    </main>
  );
}
