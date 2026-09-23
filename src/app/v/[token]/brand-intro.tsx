"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const SESSION_KEY_PREFIX = "tillz_intro_shown_";

// Timeline (seconds). Coverage is instant; only the decoration and the exit
// are animated.
//   0.0        solid white cover is on screen, no transform, fully opaque
//   0.0 – 1.1  a soft grey wave band sweeps down ACROSS the white (decor)
//   0.4 – 2.0  mark + "Powered by Tillz" fade/rise in, hold, fade out
//   2.0 – 3.0  the cover itself slides down and off, revealing the page
const TOTAL = 3;
const EXIT_AT = 2 / TOTAL; // 0.667

// A quiet ~3s brand moment on the first hard load of a table link.
//
//   - Coverage vs. motion are decoupled. The white layer that hides the page
//     is in place, untransformed and 100% opaque, from the very first frame
//     it's mounted — nothing underneath can show through or around it while
//     it holds, however slowly the page beneath is still rendering. The
//     "wave" is a decorative band travelling across that already-solid
//     layer, not the layer itself arriving. Only the EXIT moves the cover.
//   - Deliberately plain white, never the venue's brand colour, so it reads
//     as a calm neutral beat and can't clash with any theme.
//   - Decorative only: pointer-events-none, and the landing's own data and
//     entrance are never held back — the cover just hides them visually
//     until it leaves.
//   - Transform/opacity only, soft easing, no bounce.
//   - Runs once per tab session per table token (sessionStorage, guarded),
//     so Menu → Back within the app, or a router refresh, never replays it.
//   - prefers-reduced-motion: renders nothing at all — no cover, no delay.
//   - Mount-decided in an effect (not a lazy useState reading window) so the
//     server and first client render agree — no hydration mismatch, and no
//     flash-then-remove for reduced-motion or repeat visitors.
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
          {/* THE COVER. Solid white, inset-0, starts at y:0 with no entry
              animation — so it is fully covering from frame one. It only
              moves during the exit segment (t ≥ 2.0s), sliding down and
              off. Its top edge is a white curve (hanging above the panel,
              off-screen until the exit) so the reveal has the soft wave
              edge rather than a hard line. */}
          <motion.div
            className="absolute inset-0 bg-white"
            initial={{ y: "0%" }}
            animate={{ y: ["0%", "0%", "112%"] }}
            transition={{
              duration: TOTAL,
              times: [0, EXIT_AT, 1],
              ease: ["linear", "easeInOut"],
            }}
            onAnimationComplete={() => setShow(false)}
          >
            <svg
              className="absolute left-0 top-0 w-full h-[10vh] -translate-y-full"
              viewBox="0 0 1440 100"
              preserveAspectRatio="none"
            >
              <path fill="#ffffff" d="M0,100 C360,10 1080,10 1440,100 L1440,100 L0,100 Z" />
            </svg>

            {/* DECOR: a faint grey band with curved edges that sweeps down
                across the white during the first ~1.1s. This is what reads
                as "the wave coming in" — but it lives INSIDE the cover, so
                it never affects coverage. Starts above the viewport, ends
                below it (the outer overflow-hidden clips both ends). */}
            <motion.div
              className="absolute inset-x-0 top-0 h-[38vh]"
              initial={{ y: "-120%" }}
              animate={{ y: ["-120%", "300%"] }}
              transition={{ duration: 1.15, ease: [0.4, 0, 0.2, 1] }}
            >
              <svg
                className="absolute left-0 top-0 w-full h-[8vh] -translate-y-full"
                viewBox="0 0 1440 100"
                preserveAspectRatio="none"
              >
                <path fill="#f4f3f0" d="M0,100 C360,20 1080,20 1440,100 L1440,100 L0,100 Z" />
              </svg>
              <div className="absolute inset-0 bg-[#f4f3f0]" />
              <svg
                className="absolute left-0 bottom-0 w-full h-[8vh] translate-y-full"
                viewBox="0 0 1440 100"
                preserveAspectRatio="none"
              >
                <path fill="#f4f3f0" d="M0,0 C360,80 1080,80 1440,0 L1440,0 L0,0 Z" />
              </svg>
            </motion.div>

            {/* Courtesy beat: the Tillz mark (its own fixed colours from
                icon.svg — dark tile, green serif T) above a small, muted
                wordmark. One composed unit, one fade/rise. Visible only
                during the hold; gone before the cover starts to leave. */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: [0, 0, 1, 1, 0], y: [6, 6, 0, 0, -4] }}
              transition={{
                duration: TOTAL,
                times: [0, 0.13, 0.2, 0.58, EXIT_AT],
                ease: "easeInOut",
              }}
            >
              <div className="flex flex-col items-center gap-2.5 text-[color:var(--color-ink-soft)]">
                <TillzMark className="w-8 h-8" />
                <p className="flex items-baseline gap-1.5">
                  <span className="text-[10px] uppercase tracking-[0.25em] opacity-70">Powered by</span>
                  <span className="font-display text-base font-medium tracking-tight">Tillz</span>
                </p>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Inline copy of src/app/icon.svg so it renders inside the overlay with no
// network fetch and no chance of a late-arriving image. Colours are the
// mark's own (not the venue's), by design.
function TillzMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <rect width="512" height="512" rx="112" fill="#14181c" />
      <text
        x="256"
        y="356"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="300"
        fontWeight="700"
        fill="#2FB37A"
      >
        T
      </text>
    </svg>
  );
}
