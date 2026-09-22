"use client";

import { motion, useReducedMotion } from "motion/react";
import { SplitCheck } from "@/components/marketing/split-check";

// The "alive" part of the auth brand panel: the same looping bill-split
// preview the homepage hero uses, run at a gentler pace and tilted a touch,
// over two very slow drifting accent glows. Transform/opacity only; under
// reduced motion the glows sit still and the card renders its finished
// state.
export function AuthPanelArt() {
  const reduced = useReducedMotion();
  return (
    <div className="relative" aria-hidden>
      {!reduced && (
        <>
          <motion.div
            className="absolute -top-24 -left-16 w-72 h-72 rounded-pill bg-pine/50 blur-3xl"
            animate={{ x: [0, 24, 0], y: [0, 18, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-20 right-0 w-64 h-64 rounded-pill bg-pine-soft/20 blur-3xl"
            animate={{ x: [0, -20, 0], y: [0, -14, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          />
        </>
      )}
      {reduced && (
        <div className="absolute -top-24 -left-16 w-72 h-72 rounded-pill bg-pine/50 blur-3xl" />
      )}
      <div className="relative rotate-[-2deg] origin-bottom-left">
        <SplitCheck speed={0.7} />
      </div>
    </div>
  );
}
