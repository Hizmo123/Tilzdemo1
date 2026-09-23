"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { stepsFor, type TourStep } from "./tour-steps";
import { TourOverlay } from "./tour-overlay";

// Guided-tour engine. Mounted once in the dashboard layout so it survives
// route changes; the overlay itself only renders when the current step's
// page is the page we're on. Progress is mirrored to sessionStorage so a
// navigation or reload mid-tour resumes at the same step.

const STORAGE_KEY = "tillz_dashboard_tour";
const AUTOSTART_KEY = "tillz_dashboard_tour_autostarted";
const AUTOSTART_DELAY_MS = 500;

type Persisted = { active: boolean; index: number };

function load(): Persisted | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.active !== "boolean" || typeof parsed?.index !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function save(state: Persisted | null) {
  try {
    if (state) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode / storage blocked — the tour still works, it just won't
    // survive a reload.
  }
}

export type TourContextValue = {
  active: boolean;
  steps: TourStep[];
  index: number;
  step: TourStep | null;
  start: () => void;
  next: () => void;
  back: () => void;
  close: (reason: "skip" | "complete") => void;
};

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used inside <TourProvider>");
  return ctx;
}

export function TourProvider({
  ordering,
  autoStart = false,
  onFinished,
  children,
}: {
  ordering: boolean;
  // Start automatically the first time Overview is visited this session.
  // The layout decides this from the venue's tour/onboarding timestamps.
  autoStart?: boolean;
  // Called once when the tour is completed or skipped — the layout wires
  // this to the server action that records dashboardTourCompletedAt.
  onFinished?: (reason: "skip" | "complete") => void;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const steps = useMemo(() => stepsFor(ordering), [ordering]);

  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const hydrated = useRef(false);

  // Resume from a previous page of the same session.
  useEffect(() => {
    const saved = load();
    if (saved?.active && saved.index < steps.length) {
      setIndex(saved.index);
      setActive(true);
    }
    hydrated.current = true;
  }, [steps.length]);

  // Mirror to storage after every change (never before hydration, or the
  // initial "inactive" state would clobber a saved tour).
  useEffect(() => {
    if (!hydrated.current) return;
    save(active ? { active, index } : null);
  }, [active, index]);

  const goTo = useCallback(
    (nextIndex: number) => {
      const target = steps[nextIndex];
      if (!target) return;
      setIndex(nextIndex);
      if (target.page !== pathname) {
        // Persist first so the destination page resumes on this step even
        // if the navigation is a full load.
        save({ active: true, index: nextIndex });
        router.push(target.page);
      }
    },
    [steps, pathname, router],
  );

  const start = useCallback(() => {
    setActive(true);
    goTo(0);
  }, [goTo]);

  const close = useCallback(
    (reason: "skip" | "complete") => {
      setActive(false);
      setIndex(0);
      save(null);
      onFinished?.(reason);
    },
    [onFinished],
  );

  const next = useCallback(() => {
    if (index >= steps.length - 1) close("complete");
    else goTo(index + 1);
  }, [index, steps.length, goTo, close]);

  const back = useCallback(() => {
    if (index > 0) goTo(index - 1);
  }, [index, goTo]);

  // Auto-start once per session, only from Overview, after the page settles.
  useEffect(() => {
    if (!autoStart || active || pathname !== "/dashboard") return;
    try {
      if (sessionStorage.getItem(AUTOSTART_KEY) === "1") return;
      sessionStorage.setItem(AUTOSTART_KEY, "1");
    } catch {
      // Without storage we'd re-fire on every Overview render — skip the
      // auto-start rather than nag; the Replay entry point still works.
      return;
    }
    const t = setTimeout(start, AUTOSTART_DELAY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, pathname]);

  // Keyboard: Esc always closes; arrows step.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close("skip");
      } else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, close, next, back]);

  const step = active ? (steps[index] ?? null) : null;
  const value = useMemo<TourContextValue>(
    () => ({ active, steps, index, step, start, next, back, close }),
    [active, steps, index, step, start, next, back, close],
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {step && step.page === pathname && (
        <TourOverlay key={step.id} step={step} index={index} total={steps.length} onNext={next} onBack={back} onClose={() => close("skip")} />
      )}
    </TourContext.Provider>
  );
}
