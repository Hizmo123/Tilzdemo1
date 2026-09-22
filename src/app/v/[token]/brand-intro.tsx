"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const SESSION_KEY_PREFIX = "tillz_intro_shown_";

// A ~1.4s brand moment on the first hard load of a table link: a curved
// panel in the venue's own colour sweeps down from the top, holds with a
// small "Powered by Tillz", then keeps travelling off the bottom to reveal
// the landing page — which is already painted underneath the whole time.
//
//   - Decorative only. pointer-events-none, so nothing is blocked, and the
//     landing's own data/entrance are never held back — the panel just
//     covers them visually until its single translateY run ends.
//   - One translateY animation + two opacity fades: transform/opacity only.
//   - Runs once per tab session per table token (sessionStorage, guarded),
//     so Menu → Back within the app, or a router refresh, never replays it.
//   - prefers-reduced-motion: renders nothing at all — no wave, no delay.
//   - Mount-decided in an effect (not a lazy useState reading window) so the
//     server and first client render agree — no hydration mismatch, and no
//     flash-then-remove for reduced-motion users.
export function BrandIntro({ token }: { token: string }) {
  const reduced = useReducedMotion();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const key = SESSION_KEY_PREFIX + token;
    try {
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Private mode / storage blocked: still play it — worst case it replays
      // on a reload in that browser, which is harmless.
    }
    setShow(true);
  }, [reduced, token]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="brand-intro"
          aria-hidden
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          className="fixed inset-0 z-[60] pointer-events-none overflow-hidden"
        >
          {/* The sweeping panel. Taller than the viewport so its curved
              leading/trailing edges (the SVGs hanging off each end) are
              what the customer sees crossing the screen, never a hard
              horizontal line. Colours: the venue's accent gradient, with
              each curve matched to the gradient end it sits on. */}
          <motion.div
            className="absolute inset-x-0 top-0 h-[120vh] bg-accent-gradient"
            initial={{ y: "-130%" }}
            animate={{ y: ["-130%", "0%", "0%", "130%"] }}
            transition={{
              duration: 1.4,
              times: [0, 0.34, 0.66, 1],
              ease: ["easeOut", "linear", "easeIn"],
            }}
            onAnimationComplete={() => setShow(false)}
          >
            <svg
              className="absolute left-0 top-0 w-full h-[12vh] -translate-y-full text-[var(--color-pine)]"
              viewBox="0 0 1440 120"
              preserveAspectRatio="none"
            >
              <path fill="currentColor" d="M0,120 C360,0 1080,0 1440,120 L1440,120 L0,120 Z" />
            </svg>
            <svg
              className="absolute left-0 bottom-0 w-full h-[12vh] translate-y-full text-[var(--color-pine-strong)]"
              viewBox="0 0 1440 120"
              preserveAspectRatio="none"
            >
              <path fill="currentColor" d="M0,0 C360,120 1080,120 1440,0 L1440,0 L0,0 Z" />
            </svg>

            {/* Courtesy beat: small, centred, only visible during the hold. */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center text-on-accent"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: [0, 0, 1, 1, 0], y: [8, 8, 0, 0, -6] }}
              transition={{ duration: 1.4, times: [0, 0.3, 0.42, 0.6, 0.72], ease: "easeOut" }}
            >
              <p className="flex items-baseline gap-1.5 -translate-y-[10vh]">
                <span className="text-[11px] uppercase tracking-[0.22em] opacity-80">Powered by</span>
                <span className="font-display text-xl font-semibold tracking-tight">Tillz</span>
              </p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
