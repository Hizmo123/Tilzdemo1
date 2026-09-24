"use client";

import { useEffect, useId, useSyncExternalStore } from "react";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { SPRING, easeOut } from "./motion";

// Bottom sheet on phones, centred dialog from md up. Springs in, drags down
// to dismiss (past a third of its height or with a decent flick), fades its
// scrim, locks body scroll and closes on Escape. The sheet's own body
// scrolls; the header stays put.
//
// side="right" keeps the phone bottom sheet but, from md up, becomes a
// full-height slide-over panel anchored to the right edge — the "edit this
// record beside the table" pattern the dashboard's menu editor uses.
//
// Content is only mounted while open, so anything that attaches to the DOM
// (the Square card field in the pay sheet) can rely on its container
// existing once its own effect runs.
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  side = "bottom",
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg";
  side?: "bottom" | "right";
}) {
  const titleId = useId();
  const desktop = useIsDesktop();
  const slideOver = side === "right" && desktop;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  }

  const hidden = slideOver ? { x: "100%", opacity: 0.6 } : { y: "100%", opacity: 0.6 };
  const shown = slideOver ? { x: 0, opacity: 1 } : { y: 0, opacity: 1 };

  return (
    <AnimatePresence>
      {open && (
        <div
          className={`fixed inset-0 z-40 flex ${
            slideOver
              ? "items-stretch justify-end"
              : "items-end justify-center md:items-center md:p-6"
          }`}
        >
          <motion.button
            type="button"
            aria-label="Close"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={easeOut(0.2)}
            className="absolute inset-0 bg-ink/45"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            initial={hidden}
            animate={shown}
            exit={{ ...hidden, transition: easeOut(0.22) }}
            transition={SPRING}
            drag={slideOver ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={onDragEnd}
            className={`relative w-full bg-surface text-ink shadow-float flex flex-col ${
              slideOver
                ? `h-full max-h-none rounded-none ${size === "lg" ? "md:max-w-xl" : "md:max-w-md"}`
                : `max-h-[90dvh] rounded-t-[var(--radius-xl)] md:rounded-[var(--radius-xl)] md:max-h-[85vh] ${
                    size === "lg" ? "md:max-w-lg" : "md:max-w-md"
                  }`
            }`}
          >
            {/* Grab handle — the drag affordance on phones. */}
            {!slideOver && (
              <div className="md:hidden pt-2.5 pb-1 flex justify-center touch-none">
                <span className="h-1.5 w-10 rounded-pill bg-line-strong" />
              </div>
            )}
            {title !== undefined && (
              <div className="px-5 pt-2 md:pt-5 pb-3 flex items-center justify-between gap-3 border-b border-line">
                <h2 id={titleId} className="font-display text-display-sm font-semibold">
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 w-9 -mr-2 rounded-pill flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 transition-colors"
                  aria-label="Close"
                >
                  <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                    <path d="M5 5l10 10M15 5L5 15" />
                  </svg>
                </button>
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
            {footer && (
              <div className="px-5 pt-3 pb-safe border-t border-line bg-surface">{footer}</div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// md breakpoint, read the React-18 way so server and first client render
// agree (false) and it only flips once the browser has actually measured.
const DESKTOP_QUERY = "(min-width: 768px)";
function subscribe(cb: () => void) {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}
function useIsDesktop() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}
