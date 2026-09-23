"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import { EASE_OUT, DUR, fadeUp, stagger } from "@/components/ui/motion";

const VIEWPORT = { once: true, margin: "0px 0px -12% 0px" } as const;

// Scroll-triggered entrance: fade + a slight rise, using the same fadeUp
// variant the customer pages use for their first paint, so a marketing
// section and a table landing arrive the same way. Fires once, when the
// element is ~12% into the viewport. Under reduced motion the children
// render statically — no hidden state, no wait for intersection.
export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  const variants: Variants = delay
    ? {
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0, transition: { duration: DUR.slow, ease: EASE_OUT, delay } },
      }
    : fadeUp;
  return (
    <motion.div variants={variants} initial="hidden" whileInView="show" viewport={VIEWPORT} className={className}>
      {children}
    </motion.div>
  );
}

// A parent that sequences its <RevealItem> children as it scrolls into
// view — "How it works" steps, benefit rows, pricing cards.
export function RevealGroup({
  children,
  className = "",
  each = 0.09,
}: {
  children: React.ReactNode;
  className?: string;
  each?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div variants={stagger(each, 0.05)} initial="hidden" whileInView="show" viewport={VIEWPORT} className={className}>
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div variants={fadeUp} className={className}>
      {children}
    </motion.div>
  );
}
