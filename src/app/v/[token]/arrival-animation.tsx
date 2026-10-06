"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { TapRippleAnimation, ScanFrameAnimation } from "@/components/brand/marks";
import type { EntrySource } from "@/lib/entry-source";

const SESSION_KEY_PREFIX = "arrival_shown_";
// The mark's own internal motion (see marks.tsx's TapRippleAnimation/
// ScanFrameAnimation) finishes within this budget — kept separate from
// BrandIntro's ~3s "Powered by" sweep (brand-intro.tsx), which is a
// different, bigger first-load moment. This one is small, non-blocking,
// and purely about HOW they got here (tap vs scan).
const DURATION_MS = 900;

// A small, non-blocking badge (fixed, pointer-events-none, no backdrop over
// content) showing the tap/scan mark once on arrival — TapRippleMark for
// src=nfc, ScanFrameMark for src=qr. Never delays or covers the menu: it's
// an overlay ON TOP of already-rendering content, not a cover like
// BrandIntro. Session-gated the same way BrandIntro is (own key, so the two
// features can't interfere with each other's gating), so it plays once per
// tab session per table token, never on in-app Menu/Back navigation.
export function ArrivalAnimation({ token, entrySource }: { token: string; entrySource: EntrySource }) {
  const reduced = useReducedMotion();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Reduced motion: skip entirely, not even a static flash — this feature
    // is the animation, so there's nothing meaningful to show without it.
    if (reduced) return;
    const key = SESSION_KEY_PREFIX + token;
    try {
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Private mode / storage blocked: still play it once this mount —
      // worst case it replays on a reload in that browser, which is
      // harmless (same tradeoff BrandIntro makes).
    }
    setShow(true);
    const timer = setTimeout(() => setShow(false), DURATION_MS);
    return () => clearTimeout(timer);
  }, [reduced, token]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="arrival"
          aria-hidden
          className="fixed inset-x-0 top-5 z-[55] flex justify-center pointer-events-none"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          transition={{ duration: 0.25 }}
        >
          <div className="text-pine drop-shadow-[0_4px_12px_rgba(0,0,0,0.18)]">
            {entrySource === "nfc" ? (
              <TapRippleAnimation size={56} />
            ) : (
              <ScanFrameAnimation size={56} />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
