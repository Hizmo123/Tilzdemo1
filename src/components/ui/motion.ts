// Shared motion vocabulary — one place for the springs, eases and entrance
// variants every animated surface uses, so a sheet, a cart bar and a toast
// all move the same way. Durations mirror the CSS tokens in globals.css
// (--dur-fast/base/slow).
//
// Everything animates transform/opacity only. <MotionConfig
// reducedMotion="user"> (mounted in ToastProvider at the root) turns the
// transform side of all of this off automatically when the OS asks for
// reduced motion, leaving the opacity fades.

import type { Transition, Variants } from "motion/react";

export const DUR = { fast: 0.15, base: 0.25, slow: 0.4 } as const;

// Playful, slightly overshooting — sheets, cart bar, added-to-cart pulses.
export const SPRING: Transition = { type: "spring", stiffness: 420, damping: 34, mass: 0.9 };
// Calmer — layout moves, segmented-control indicator.
export const SPRING_SOFT: Transition = { type: "spring", stiffness: 300, damping: 32, mass: 1 };
// Snappy press feedback.
export const SPRING_PRESS: Transition = { type: "spring", stiffness: 600, damping: 30 };

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export const easeOut = (duration: number = DUR.base): Transition => ({ duration, ease: EASE_OUT });

// Standard entrance: rise a touch and fade in. Pair with `stagger` on the
// parent to sequence a hero's children.
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: easeOut(DUR.slow) },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: easeOut(DUR.base) },
};

export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1, transition: SPRING },
};

export function stagger(each = 0.06, delayChildren = 0.05): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren: each, delayChildren } },
  };
}

// A short haptic tick where the platform supports it (Android Chrome; iOS
// Safari ignores it). Never throws, never delays the tap it decorates.
export function haptic(pattern: number | number[] = 10) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    // ignore
  }
}
