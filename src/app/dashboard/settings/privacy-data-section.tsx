"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ACCOUNT_RETENTION_YEARS } from "@/lib/account-retention";
import { BRAND } from "@/lib/brand";
import { deleteAccountAction } from "./privacy-actions";

// idle -> warn (what will happen) -> confirm (type the name) -> final (last
// yes/no) -> the action runs and the browser is sent to /account-closed. Any
// Cancel/No before the final "Yes" returns to idle with nothing changed.
type Step = "idle" | "warn" | "confirm" | "final";

export function PrivacyDataSection({
  organizationName,
  isOwner,
}: {
  organizationName: string;
  isOwner: boolean;
}) {
  const [step, setStep] = useState<Step>("idle");
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  // Each step replaces the last in place, so move focus to the new step's
  // heading — otherwise a keyboard or screen-reader user is left on a button
  // that no longer exists. (Step 2's input takes focus itself via autoFocus.)
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (step === "warn" || step === "final") headingRef.current?.focus();
  }, [step]);

  const nameMatches = confirmName.trim() === organizationName;
  const busy = pending || done;

  function reset() {
    setStep("idle");
    setConfirmName("");
    setError(null);
  }

  function deleteNow() {
    setError(null);
    start(async () => {
      const res = await deleteAccountAction(confirmName);
      if (res.error) {
        setError(res.error);
        return;
      }
      // The account is closed and this session is signed out. A hard
      // navigation (not router.push) so no cached, now-unusable dashboard
      // state survives, and it lands on a plain page rather than the dashboard.
      setDone(true);
      window.location.assign("/account-closed");
    });
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">Your data</h2>
        <p className="text-sm text-muted mt-1">
          Export what {BRAND.name} holds about your venue, or close your account.
        </p>
      </div>

      <div>
        <p className="text-sm font-medium mb-1">Export your data</p>
        <p className="text-sm text-muted mb-2">
          Your venues, floor plan, menu and staff list as a JSON file. Bill
          and payment history is available separately as a dated CSV from{" "}
          <a href="/dashboard/invoices" className="text-pine hover:underline">
            Invoices
          </a>
          .
        </p>
        <a
          href="/dashboard/settings/export"
          className="inline-block text-sm rounded-[var(--radius-sm)] border border-line bg-surface px-3.5 py-2 font-medium hover:border-ink/30 transition-colors"
        >
          Download export
        </a>
      </div>

      <div className="border-t border-line pt-5">
        <p className="text-sm font-medium mb-1 text-danger">Delete your account</p>

        {!isOwner ? (
          <p className="text-sm text-muted">Only the owner can do this.</p>
        ) : step === "idle" ? (
          <>
            <p className="text-sm text-muted mb-3">
              Permanently close {organizationName}. This takes effect immediately.
            </p>
            <Button type="button" variant="secondary" size="sm" onClick={() => setStep("warn")} className="text-danger">
              Delete account…
            </Button>
          </>
        ) : (
          <div
            role="group"
            aria-label="Delete account"
            className="rounded-[var(--radius-card)] border border-danger/30 bg-danger-soft/50 p-5 shadow-raised space-y-4"
          >
            {step === "warn" && (
              <>
                <div>
                  <h3
                    ref={headingRef}
                    tabIndex={-1}
                    className="font-display text-lg font-semibold tracking-tight text-danger outline-none"
                  >
                    Before you delete {organizationName}
                  </h3>
                  <p className="text-sm text-ink-soft mt-1">
                    Deleting closes the account straight away. Please read what that means:
                  </p>
                </div>
                <ul className="space-y-2 text-sm text-ink-soft list-disc pl-5 marker:text-danger">
                  <li>
                    <strong className="text-ink">Everyone is signed out immediately</strong> — you, your team, and
                    every staff PIN login. Nobody can sign in again.
                  </li>
                  <li>
                    <strong className="text-ink">Your tables and QR codes stop taking orders</strong> the moment you
                    confirm.
                  </li>
                  <li>
                    <strong className="text-ink">Your subscription is cancelled right away</strong> and won&apos;t
                    renew.
                  </li>
                  <li>
                    <strong className="text-ink">Your menu, images, uploaded files, staff accounts and branding are
                    permanently deleted.</strong>
                  </li>
                  <li>
                    <strong className="text-ink">This cannot be undone.</strong>
                  </li>
                  <li>
                    Records of payments and refunds — and the bills and orders they belong to — are kept privately
                    for {ACCOUNT_RETENTION_YEARS} years because Australian law requires it. You won&apos;t be able to
                    access them, and after that they&apos;re permanently deleted.
                  </li>
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="danger" onClick={() => setStep("confirm")}>
                    I understand, continue
                  </Button>
                  <Button type="button" variant="secondary" onClick={reset}>
                    Cancel
                  </Button>
                </div>
              </>
            )}

            {step === "confirm" && (
              <>
                <div>
                  <h3 className="font-display text-lg font-semibold tracking-tight text-danger">
                    Confirm account deletion
                  </h3>
                  <p className="text-sm text-ink-soft mt-1">
                    This will permanently close <strong className="text-ink">{organizationName}</strong>&apos;s
                    account. Type <strong className="text-ink">{organizationName}</strong> to confirm.
                  </p>
                </div>
                <div>
                  <label htmlFor="delete-confirm-name" className="sr-only">
                    Type {organizationName} to confirm
                  </label>
                  <input
                    id="delete-confirm-name"
                    autoFocus
                    autoComplete="off"
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={organizationName}
                    className="w-full h-11 rounded-[var(--radius-md)] border border-danger/40 bg-surface px-3.5 text-ink shadow-rest placeholder:text-muted/60 focus:outline-none focus:border-danger focus:ring-[3px] focus:ring-danger/20"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="danger" disabled={!nameMatches} onClick={() => setStep("final")}>
                    Delete account
                  </Button>
                  <Button type="button" variant="secondary" onClick={reset}>
                    Cancel
                  </Button>
                </div>
              </>
            )}

            {step === "final" && (
              <>
                <div>
                  <h3
                    ref={headingRef}
                    tabIndex={-1}
                    className="font-display text-lg font-semibold tracking-tight text-danger outline-none"
                  >
                    Are you absolutely sure?
                  </h3>
                  <p className="text-sm text-ink-soft mt-1">
                    This is your last chance. {organizationName} will be closed right now, and this can&apos;t be
                    undone.
                  </p>
                </div>
                {error && (
                  <p role="alert" className="rounded-[var(--radius-sm)] bg-danger-soft text-danger px-3.5 py-2.5 text-sm">
                    {error}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="danger" loading={busy} onClick={deleteNow}>
                    {busy ? "Deleting…" : "Yes, delete permanently"}
                  </Button>
                  <Button type="button" variant="secondary" disabled={busy} onClick={() => setStep("confirm")}>
                    No, go back
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
