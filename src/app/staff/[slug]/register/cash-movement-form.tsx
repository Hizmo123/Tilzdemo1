"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCashMovement } from "./actions";

export function CashMovementForm({ slug, sessionId }: { slug: string; sessionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<"PAID_IN" | "PAID_OUT" | null>(null);
  const [amountDollars, setAmountDollars] = useState("");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!open) return;
    const cents = Math.round(Number(amountDollars) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!reason.trim()) {
      setError("Enter a reason.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await addCashMovement(slug, sessionId, open, cents, reason.trim());
      if ("error" in res) setError(res.error ?? "Something went wrong.");
      else {
        setOpen(null);
        setAmountDollars("");
        setReason("");
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen("PAID_IN")}
          className="text-xs rounded-md border border-line px-2.5 py-1.5 hover:border-ink/30"
        >
          Paid in
        </button>
        <button
          type="button"
          onClick={() => setOpen("PAID_OUT")}
          className="text-xs rounded-md border border-line px-2.5 py-1.5 hover:border-ink/30"
        >
          Paid out
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line p-3 space-y-2 max-w-xs">
      <p className="text-xs font-medium">
        {open === "PAID_IN" ? "Paid in" : "Paid out"}
      </p>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">$</span>
        <input
          inputMode="decimal"
          value={amountDollars}
          onChange={(e) => setAmountDollars(e.target.value)}
          placeholder="20.00"
          className="w-full rounded-lg border border-line bg-surface pl-7 pr-3.5 py-2 text-sm focus:border-pine focus:outline-none"
        />
      </div>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (e.g. petty cash, safe drop)"
        className="w-full rounded-lg border border-line bg-surface px-3.5 py-2 text-sm focus:border-pine focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="text-xs rounded-md bg-ink text-surface px-2.5 py-1.5 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Confirm"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setOpen(null);
            setError(null);
          }}
          className="text-xs text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
