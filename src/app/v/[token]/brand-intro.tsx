"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const SESSION_KEY_PREFIX = "tillz_intro_shown_";

// A quiet ~3s brand moment on the first hard load of a table link: a soft,
// low-contrast wave washes down over the (already-painted) landing page,
// pauses on a small "Powered by Tillz" wordmark, then continues down and
// off the bottom of the screen. Deliberately plain white — never the
// venue's brand colour — so it reads as a calm, neutral beat rather than
// venue chrome, and never clashes with whatever theme the venue picked.
//
//   - Decorative only. pointer-events-none, so nothing is blocked, and the
//     landing's own data/entrance are never held back — the panel just
//     covers them visually until its single translateY run ends.
//   - One translateY animation + one opacity/y fade for the wordmark:
//     transform/opacity only, soft ease, no bounce.
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
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          className="fixed inset-0 z-[60] pointer-events-none overflow-hidden"
        >
          {/* The sweeping panel: plain white, taller than the viewport so
              its soft curved leading/trailing edges (faint grey tint, not
              a hard line) are what's visible crossing the screen. */}
          <motion.div
            className="absolute inset-x-0 top-0 h-[130vh] bg-white"
            initial={{ y: "-108%" }}
            animate={{ y: ["-108%", "0%", "0%", "108%"] }}
            transition={{
              duration: 3,
              times: [0, 0.34, 0.62, 1],
              ease: ["easeInOut", "linear", "easeInOut"],
            }}
            onAnimationComplete={() => setShow(false)}
          >
            <svg
              className="absolute left-0 top-0 w-full h-[8vh] -translate-y-full"
              viewBox="0 0 1440 100"
              preserveAspectRatio="none"
            >
              <path fill="#f4f3f0" d="M0,100 C360,20 1080,20 1440,100 L1440,100 L0,100 Z" />
            </svg>
            <svg
              className="absolute left-0 bottom-0 w-full h-[8vh] translate-y-full"
              viewBox="0 0 1440 100"
              preserveAspectRatio="none"
            >
              <path fill="#f4f3f0" d="M0,0 C360,80 1080,80 1440,0 L1440,0 L0,0 Z" />
            </svg>

            {/* Courtesy beat: small, quiet, centred — visible only during
                the hold, refined rather than bold. */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: [0, 0, 1, 1, 0], y: [6, 6, 0, 0, -4] }}
              transition={{ duration: 3, times: [0, 0.3, 0.42, 0.58, 0.7], ease: "easeInOut" }}
            >
              <p className="flex items-baseline gap-1.5 text-[color:var(--color-ink-soft)]">
                <span className="text-[10px] uppercase tracking-[0.25em] opacity-70">Powered by</span>
                <span className="font-display text-base font-medium tracking-tight">Tillz</span>
              </p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
