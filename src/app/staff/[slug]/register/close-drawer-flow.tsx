"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { previewZReport, closeDrawer } from "./actions";
import { ZReportView } from "@/components/register/z-report-view";
import { formatCents } from "@/lib/money";
import type { ZReport } from "@/lib/cash-drawer";

type Step = "closed" | "counting" | "reviewing" | "done";

export function CloseDrawerFlow({
  slug,
  sessionId,
  restaurantName,
  locationName,
  currency,
}: {
  slug: string;
  sessionId: string;
  restaurantName: string;
  locationName: string;
  currency: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("closed");
  const [countedDollars, setCountedDollars] = useState("");
  const [preview, setPreview] = useState<ZReport | null>(null);
  const [finalReport, setFinalReport] = useState<ZReport | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const countedCents = Math.round(Number(countedDollars) * 100);

  function goReview() {
    if (!Number.isFinite(countedCents) || countedCents < 0) {
      setError("Enter a valid counted cash total.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await previewZReport(slug, sessionId);
      if ("error" in res) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      setPreview(res.report);
      setStep("reviewing");
    });
  }

  function confirmClose() {
    setError(null);
    start(async () => {
      const res = await closeDrawer(slug, sessionId, countedCents);
      if ("error" in res) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      setFinalReport(res.report);
      setStep("done");
    });
  }

  if (step === "done" && finalReport) {
    return (
      <div className="space-y-4">
        <ZReportView
          report={finalReport}
          restaurantName={restaurantName}
          locationName={locationName}
          currency={currency}
        />
        <div className="flex justify-center gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="rounded-[var(--radius-md)] bg-ink text-surface px-5 py-2.5 text-sm font-medium hover:opacity-90"
          >
            Print / Save PDF
          </button>
          <button
            onClick={() => router.refresh()}
            className="rounded-[var(--radius-md)] border border-line px-5 py-2.5 text-sm font-medium hover:border-ink/30"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  if (step === "reviewing" && preview) {
    const variance = countedCents - preview.expectedCashCents;
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 space-y-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">Confirm close</h2>
        <div className="text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted">Expected cash</span>
            <span className="tabular-nums">{formatCents(preview.expectedCashCents, currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Counted cash</span>
            <span className="tabular-nums">{formatCents(countedCents, currency)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>{variance >= 0 ? "Over" : "Short"}</span>
            <span className={`tabular-nums ${variance !== 0 ? "text-danger" : ""}`}>
              {formatCents(Math.abs(variance), currency)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={confirmClose}
            className="rounded-[var(--radius-sm)] bg-pine text-white px-4 py-2.5 text-sm font-medium hover:bg-pine-deep disabled:opacity-60"
          >
            {pending ? "Closing…" : "Confirm — close drawer"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setStep("counting")}
            className="rounded-[var(--radius-sm)] border border-line px-4 py-2.5 text-sm hover:border-ink/30"
          >
            Back
          </button>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    );
  }

  if (step === "counting") {
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 space-y-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">Count the drawer</h2>
        <p className="text-sm text-muted">Enter the physical cash total counted.</p>
        <div className="relative max-w-[160px]">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">$</span>
          <input
            inputMode="decimal"
            value={countedDollars}
            onChange={(e) => setCountedDollars(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-[var(--radius-md)] border border-line bg-surface pl-7 pr-3.5 py-2.5 text-sm focus:border-pine focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={goReview}
            className="rounded-[var(--radius-sm)] bg-ink text-surface px-4 py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {pending ? "…" : "Review"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setStep("closed")}
            className="rounded-[var(--radius-sm)] border border-line px-4 py-2.5 text-sm hover:border-ink/30"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setStep("counting")}
      className="rounded-[var(--radius-sm)] border border-danger/40 text-danger px-4 py-2.5 text-sm font-medium hover:bg-danger-soft"
    >
      Close drawer
    </button>
  );
}
