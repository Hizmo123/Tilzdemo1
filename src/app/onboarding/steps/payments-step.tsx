"use client";

import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { OnboardingAnswers, PaymentPath } from "@/lib/onboarding-options";
import type { PendingSquareSummary } from "@/lib/square/pending";
import { Button } from "@/components/ui/button";
import { SPRING, SPRING_PRESS } from "@/components/ui/motion";
import { discardPendingSquare, listPendingSquareLocations, setPendingSquareLocation } from "../actions";
import type { SquareResult } from "../square-result";

const ERROR_COPY: Record<string, string> = {
  state_mismatch: "That connection attempt expired or didn't match — please try again.",
  missing_params: "Square didn't return the expected response — please try again.",
  exchange_failed: "Couldn't complete the connection with Square — please try again.",
  access_denied: "Square connection was cancelled.",
};

// The wizard's Payments step. Two paths:
//   square — runs the REAL Square OAuth (same /api/square/authorize +
//            /callback as Settings → Integrations, in onboarding mode). The
//            round trip leaves the wizard, so the caller saves the draft
//            first (onBeforeRedirect) and the wizard resumes here on return
//            with `square` populated from PendingSquareConnection.
//   tillz  — Tillz's own payment flow; nothing to connect.
export function PaymentsStep({
  answers,
  update,
  square,
  onSquareChange,
  squareResult,
  returnTo,
  onBeforeRedirect,
}: {
  answers: OnboardingAnswers;
  update: (patch: Partial<OnboardingAnswers>) => void;
  square: PendingSquareSummary | null;
  onSquareChange: (next: PendingSquareSummary | null) => void;
  squareResult: SquareResult | null;
  returnTo: "/onboarding" | "/venues/new";
  onBeforeRedirect: () => Promise<void>;
}) {
  const [redirecting, setRedirecting] = useState(false);
  const [pending, start] = useTransition();
  const [locations, setLocations] = useState<{ id: string; name: string }[] | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [justConnected, setJustConnected] = useState(squareResult?.status === "success");

  // Load the merchant's locations once connected; auto-pick when there's
  // exactly one so a single-site venue never has to touch the select.
  useEffect(() => {
    if (!square) {
      setLocations(null);
      return;
    }
    let cancelled = false;
    listPendingSquareLocations()
      .then((list) => {
        if (cancelled) return;
        setLocations(list);
        if (list.length === 1 && !square.locationId) {
          start(async () => {
            const res = await setPendingSquareLocation(list[0].id);
            if ("ok" in res) onSquareChange({ ...square, locationId: list[0].id });
          });
        }
      })
      .catch(() => !cancelled && setLocations([]));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [square?.merchantName, square?.environment]);

  // The "Connected" flourish only plays once, right after the round trip.
  useEffect(() => {
    if (!justConnected) return;
    const t = setTimeout(() => setJustConnected(false), 2400);
    return () => clearTimeout(t);
  }, [justConnected]);

  async function connect() {
    setRedirecting(true);
    update({ paymentPath: "square" });
    try {
      await onBeforeRedirect();
    } catch {
      // Best-effort — losing the draft is recoverable; losing the redirect isn't.
    }
    window.location.assign(`/api/square/authorize?flow=onboarding&return=${encodeURIComponent(returnTo)}`);
  }

  function pickLocation(id: string) {
    if (!square) return;
    setLocError(null);
    start(async () => {
      const res = await setPendingSquareLocation(id);
      if ("error" in res) setLocError(res.error);
      else onSquareChange({ ...square, locationId: id });
    });
  }

  function disconnect() {
    start(async () => {
      await discardPendingSquare();
      onSquareChange(null);
      setLocations(null);
    });
  }

  const path = answers.paymentPath;

  return (
    <div className="space-y-4">
      <div role="radiogroup" className="space-y-2">
        <PathCard
          selected={path === "square"}
          onClick={() => update({ paymentPath: "square" })}
          title="Connect your Square"
          desc="Card payments settle into your own Square account, and every order lands on your Square POS and kitchen display. Square's per-transaction fee applies."
          icon={<SquareMark />}
        />
        <PathCard
          selected={path === "tillz"}
          onClick={() => update({ paymentPath: "tillz" })}
          title="Use Tillz payments"
          desc="No Square account needed. Test mode today — real card payments through Tillz are coming; you can switch to Square any time in Settings."
          badge="Test mode"
          icon={<TillzMark />}
        />
      </div>

      <AnimatePresence initial={false} mode="wait">
        {path === "square" && (
          <motion.div
            key={square ? "connected" : "connect"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {!square ? (
              <div className="rounded-[var(--radius-card)] border border-line bg-surface shadow-rest p-4">
                <p className="text-sm text-ink-soft">
                  You&apos;ll be taken to Square to sign in and approve Tillz, then brought straight back here.
                </p>
                {squareResult?.status === "error" && (
                  <p role="alert" className="mt-3 rounded-[var(--radius-sm)] bg-danger-soft text-danger px-3.5 py-2.5 text-sm">
                    {ERROR_COPY[squareResult.reason] ?? "Couldn't connect Square — please try again."}
                  </p>
                )}
                <div className="mt-4">
                  <Button onClick={connect} loading={redirecting} full>
                    {redirecting ? "Taking you to Square…" : "Connect Square"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-[var(--radius-card)] border border-pine/30 bg-pine-tint shadow-rest p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="relative inline-flex w-9 h-9 items-center justify-center rounded-pill bg-pine text-on-accent shrink-0">
                    {justConnected && (
                      <span aria-hidden className="absolute inset-0 rounded-pill bg-pine/40 animate-pulse-ring" />
                    )}
                    <svg viewBox="0 0 20 20" className="relative w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <motion.path
                        d="M4 10.5l3.5 3.5L16 6"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.35, delay: 0.1 }}
                      />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {justConnected ? "Square connected" : "Connected to Square"}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {square.merchantName ?? "Your Square account"}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] rounded-pill px-2.5 py-1 font-medium shrink-0 ${
                      square.environment === "production" ? "bg-pine-soft text-pine-deep" : "bg-warn-soft text-warn"
                    }`}
                  >
                    {square.environment === "production" ? "Production" : "Sandbox"}
                  </span>
                </div>

                <div>
                  <label htmlFor="square-location" className="text-sm font-medium text-ink-soft block mb-1.5">
                    Which Square location is this venue?
                  </label>
                  <div className="relative">
                    <select
                      id="square-location"
                      value={square.locationId ?? ""}
                      disabled={pending || locations === null}
                      onChange={(e) => pickLocation(e.target.value)}
                      className="w-full h-11 appearance-none rounded-[var(--radius-md)] bg-surface border border-line shadow-rest px-3.5 pr-10 text-sm focus:outline-none focus:border-pine focus:ring-[3px] focus:ring-pine/20 disabled:opacity-60"
                    >
                      <option value="" disabled>
                        {locations === null ? "Loading locations…" : locations.length === 0 ? "No locations found" : "Choose a location"}
                      </option>
                      {locations?.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                    <svg viewBox="0 0 20 20" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M5 8l5 5 5-5" />
                    </svg>
                  </div>
                  {locError && <p className="text-xs text-danger mt-1.5">{locError}</p>}
                </div>

                <button
                  type="button"
                  onClick={disconnect}
                  disabled={pending}
                  className="text-xs text-muted hover:text-danger disabled:opacity-60"
                >
                  Use a different Square account
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PathCard({
  selected,
  onClick,
  title,
  desc,
  icon,
  badge,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  icon: React.ReactNode;
  badge?: string;
}) {
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      transition={SPRING_PRESS}
      className={`w-full text-left rounded-[var(--radius-card)] bg-surface p-4 flex items-start gap-3 transition-[box-shadow,background-color] duration-[var(--dur-fast)] ${
        selected ? "ring-2 ring-pine shadow-raised bg-pine-tint" : "border border-line shadow-rest hover:shadow-raised"
      }`}
    >
      <span
        className={`shrink-0 w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center transition-colors duration-[var(--dur-fast)] ${
          selected ? "bg-pine text-on-accent" : "bg-surface-2 text-ink-soft"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold">{title}</span>
          {badge && (
            <span className="text-[10px] uppercase tracking-wide font-medium rounded-pill px-2 py-0.5 bg-warn-soft text-warn">
              {badge}
            </span>
          )}
        </span>
        <span className="block text-xs text-muted mt-1 leading-relaxed">{desc}</span>
      </span>
      <span
        aria-hidden
        className={`shrink-0 mt-1 w-5 h-5 rounded-pill border-2 flex items-center justify-center transition-colors duration-[var(--dur-fast)] ${
          selected ? "border-pine bg-pine text-on-accent" : "border-line-strong"
        }`}
      >
        {selected && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING} className="w-2 h-2 rounded-pill bg-current" />
        )}
      </span>
    </motion.button>
  );
}

// Generic "card terminal" glyph — not Square's trademarked logo.
function SquareMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TillzMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <path d="M3 10h18" />
      <path d="M7 14.5h4" />
    </svg>
  );
}
