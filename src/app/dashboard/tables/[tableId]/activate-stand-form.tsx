"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { activateStandForTable, resolveScannedStandCode } from "../actions";
import type { TableActionState } from "../actions";
import { Label, Input, FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { StandScanner } from "./stand-scanner";

const initial: TableActionState = {};

// Restored entry point for stand activation (see this task's report — the
// function was never removed, only its render, by an earlier "declutter"
// pass). Collapsed behind a clearly-labelled action by default rather than
// an always-visible form, addressing that same declutter intent without
// losing the function: TablePage only renders this at all when the table
// has no active stand yet (see page.tsx).
export function ActivateStandForm({ tableId }: { tableId: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"manual" | "scan">("manual");
  const [scanError, setScanError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  // Set by handleDecoded, consumed by the effect below once the manual
  // form (and its input) actually exists in the DOM again — more reliable
  // than guessing a frame delay after switching mode back from "scan".
  const [pendingSerial, setPendingSerial] = useState<string | null>(null);

  const action = activateStandForTable.bind(null, tableId);
  const [state, formAction] = useActionState(action, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const serialInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state && !state.error) formRef.current?.reset();
  }, [state]);

  // Fires once the manual form (and its input) is actually back in the DOM
  // after handleDecoded below switches mode away from "scan" — filling the
  // input and submitting here, rather than right after the switch, avoids
  // racing React's render/commit.
  useEffect(() => {
    if (mode !== "manual" || !pendingSerial) return;
    if (serialInputRef.current) serialInputRef.current.value = pendingSerial;
    setPendingSerial(null);
    formRef.current?.requestSubmit();
  }, [mode, pendingSerial]);

  // Scanning only changes how the serial gets INTO the input — it submits
  // through the exact same form/action manual entry does, so activation
  // logic, permission checks and error handling are all identical either
  // way. See ../actions.ts#resolveScannedStandCode for why a scanned code
  // isn't necessarily the serial itself.
  async function handleDecoded(raw: string) {
    if (resolving) return; // ignore repeat frames while one resolve is in flight
    setResolving(true);
    setScanError(null);
    const res = await resolveScannedStandCode(raw);
    setResolving(false);
    if ("error" in res) {
      setScanError(res.error);
      return;
    }
    setPendingSerial(res.serial);
    setMode("manual");
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line bg-surface px-6 py-4 text-left hover:border-pine/40 transition-colors"
      >
        <span className="shrink-0 w-9 h-9 rounded-pill bg-pine-soft text-pine-deep flex items-center justify-center">
          <svg viewBox="0 0 20 20" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="3" width="6" height="6" rx="1" />
            <rect x="11" y="3" width="6" height="6" rx="1" />
            <rect x="3" y="11" width="6" height="6" rx="1" />
            <path d="M13 13h2v2h-2zM17 13h0v0M13 17h2M17 15v2h-2" />
          </svg>
        </span>
        <span>
          <span className="block text-sm font-medium">Activate a Tillz stand</span>
          <span className="block text-xs text-muted">Scan or type its serial to put it on this table.</span>
        </span>
      </button>
    );
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Activate a stand
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>

      {mode === "scan" ? (
        <>
          <p className="text-sm text-muted mb-4">
            Point the camera at the code on the stand.
          </p>
          <StandScanner onDecoded={handleDecoded} onCancel={() => setMode("manual")} />
          {resolving && <p className="text-xs text-muted text-center mt-2">Checking code…</p>}
          {scanError && (
            <div className="mt-3">
              <FormMessage tone="error">{scanError}</FormMessage>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-muted mb-4">
            Type the serial printed on the physical stand to put it on this table.
          </p>
          <form ref={formRef} action={formAction} className="space-y-4">
            <div className="max-w-xs">
              <Label htmlFor="serial">Stand serial</Label>
              <Input
                ref={serialInputRef}
                id="serial"
                name="serial"
                placeholder="TZ-000123"
                required
              />
            </div>

            {state.error && <FormMessage tone="error">{state.error}</FormMessage>}

            <div className="flex items-center gap-3">
              <div className="max-w-[160px]">
                <SubmitButton pendingLabel="Activating…">Activate</SubmitButton>
              </div>
              <button
                type="button"
                onClick={() => {
                  setScanError(null);
                  setMode("scan");
                }}
                className="text-sm text-pine hover:underline"
              >
                Scan a code instead
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
