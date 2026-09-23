"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { SPRING_SOFT, EASE_OUT } from "@/components/ui/motion";
import type { TourStep } from "./tour-steps";

// One step's spotlight + tooltip. Finds the real element by data-tour,
// scrolls it into view if needed, then follows its bounding rect on
// resize/scroll. Rendered through a portal so no dashboard container's
// overflow or stacking can clip it.
//
// Nothing here blocks the page: the dim layer and the spotlight are
// pointer-events-none, so the underlying UI stays fully usable — the only
// interactive surface is the tooltip card itself.

const PAD = 8; // spotlight padding around the target
const GAP = 14; // tooltip distance from the spotlight
const EDGE = 16; // viewport margin
const FIND_TIMEOUT_MS = 2500;
const FIND_INTERVAL_MS = 100;

type Rect = { top: number; left: number; width: number; height: number };

function measure(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
}

function fullyVisible(el: Element) {
  const r = el.getBoundingClientRect();
  return r.top >= 0 && r.bottom <= window.innerHeight;
}

export function TourOverlay({
  step,
  index,
  total,
  onNext,
  onBack,
  onClose,
}: {
  step: TourStep;
  index: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const [tip, setTip] = useState<{ w: number; h: number }>({ w: 320, h: 160 });
  const tipRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<Element | null>(null);

  useEffect(() => setMounted(true), []);

  // Find the target (it may render async — Suspense, client hydration),
  // scroll it into view, then track it. If it never appears, move on so
  // the tour can't stall on a step whose UI isn't there (e.g. a checklist
  // that's already complete).
  useEffect(() => {
    let cancelled = false;
    let tracking: (() => void) | null = null;
    const started = Date.now();

    const track = (el: Element) => {
      targetRef.current = el;
      const update = () => !cancelled && setRect(measure(el));
      update();
      const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
      ro?.observe(el);
      window.addEventListener("resize", update);
      window.addEventListener("scroll", update, true);
      tracking = () => {
        ro?.disconnect();
        window.removeEventListener("resize", update);
        window.removeEventListener("scroll", update, true);
      };
    };

    const tick = () => {
      if (cancelled) return;
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el) {
        if (!fullyVisible(el)) {
          el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
          // Let the scroll settle before the first measurement so the ring
          // doesn't animate in from the pre-scroll position.
          setTimeout(() => !cancelled && track(el), reduced ? 0 : 350);
        } else {
          track(el);
        }
        return;
      }
      if (Date.now() - started > FIND_TIMEOUT_MS) {
        onNext();
        return;
      }
      setTimeout(tick, FIND_INTERVAL_MS);
    };
    tick();

    return () => {
      cancelled = true;
      tracking?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.target]);

  // Measure the tooltip so placement can use its real size.
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el) return;
    setTip({ w: el.offsetWidth, h: el.offsetHeight });
  }, [rect, step.id]);

  // Move focus to the card on each step so keyboard users land on the
  // controls; the page underneath is untouched.
  useEffect(() => {
    if (rect) tipRef.current?.focus({ preventScroll: true });
  }, [rect, step.id]);

  if (!mounted || !rect) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = rect.left + rect.width / 2;
  const below = rect.top + rect.height + GAP;
  const fitsBelow = below + tip.h <= vh - EDGE;
  const fitsAbove = rect.top - GAP - tip.h >= EDGE;
  const placeBelow = step.placement === "bottom" || (step.placement !== "top" && (fitsBelow || !fitsAbove));
  const top = placeBelow ? below : rect.top - GAP - tip.h;
  const left = Math.min(Math.max(cx - tip.w / 2, EDGE), Math.max(EDGE, vw - tip.w - EDGE));
  const arrowX = Math.min(Math.max(cx - left, 20), tip.w - 20);

  const move = reduced ? { duration: 0 } : SPRING_SOFT;
  const fade = { duration: reduced ? 0.15 : 0.2, ease: EASE_OUT };
  const last = index === total - 1;

  return createPortal(
    <div className="fixed inset-0 z-[70] pointer-events-none" aria-hidden={false}>
      {/* Spotlight: the cutout is the box; the dim is its enormous outer
          shadow, so the page shows through only inside the ring. Soft
          accent ring rather than a hard black mask. */}
      <motion.div
        initial={reduced ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1, top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        transition={{ opacity: fade, scale: fade, top: move, left: move, width: move, height: move }}
        className="absolute rounded-[var(--radius-md)]"
        style={{
          boxShadow:
            "0 0 0 3px var(--color-pine-glow), 0 0 0 9999px color-mix(in srgb, var(--color-ink) 42%, transparent)",
        }}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          ref={tipRef}
          role="dialog"
          aria-labelledby={`tour-title-${step.id}`}
          aria-describedby={`tour-body-${step.id}`}
          tabIndex={-1}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: placeBelow ? 6 : -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={fade}
          className="absolute pointer-events-auto outline-none w-[min(320px,calc(100vw-32px))] rounded-[var(--radius-lg)] bg-surface border border-line shadow-float p-4"
          style={{ top, left }}
        >
          {/* Pointer */}
          <span
            aria-hidden
            className={`absolute w-3 h-3 bg-surface border-line rotate-45 ${
              placeBelow ? "-top-[7px] border-l border-t" : "-bottom-[7px] border-r border-b"
            }`}
            style={{ left: arrowX - 6 }}
          />

          <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted tabular">
              {index + 1} of {total}
            </p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close tour"
              className="-mt-1.5 -mr-1.5 w-8 h-8 rounded-pill text-muted hover:text-ink hover:bg-surface-2 flex items-center justify-center transition-colors duration-[var(--dur-fast)]"
            >
              <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </div>

          <h2 id={`tour-title-${step.id}`} className="font-display text-base font-semibold mt-1">
            {step.title}
          </h2>
          <p id={`tour-body-${step.id}`} className="text-sm text-ink-soft mt-1.5 leading-relaxed">
            {step.body}
          </p>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5" aria-hidden>
              {Array.from({ length: total }, (_, i) => (
                <motion.span
                  key={i}
                  animate={{ width: i === index ? 16 : 6, opacity: i === index ? 1 : i < index ? 0.6 : 0.3 }}
                  transition={move}
                  className="h-1.5 rounded-pill bg-pine"
                />
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              {index > 0 && (
                <Button variant="ghost" size="sm" onClick={onBack}>
                  Back
                </Button>
              )}
              <Button size="sm" onClick={onNext}>
                {last ? "Done" : "Next"}
              </Button>
            </div>
          </div>

          {!last && (
            <button
              type="button"
              onClick={onClose}
              className="mt-3 text-xs text-muted hover:text-ink transition-colors duration-[var(--dur-fast)]"
            >
              Skip tour
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body,
  );
}
