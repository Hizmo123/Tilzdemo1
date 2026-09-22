"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import { formatCents } from "@/lib/money";

// Money that counts to its new value instead of snapping. Renders the plain
// formatted amount on the server / first paint (no flash of "0"), then
// tweens between values on change. Reduced-motion users get the snap.
export function AnimatedMoney({
  cents,
  currency,
  className = "",
  duration = 0.55,
}: {
  cents: number;
  currency: string;
  className?: string;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(cents);
  const previous = useRef(cents);

  useEffect(() => {
    if (reduced || previous.current === cents) {
      previous.current = cents;
      setDisplay(cents);
      return;
    }
    const controls = animate(previous.current, cents, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    previous.current = cents;
    return () => controls.stop();
  }, [cents, duration, reduced]);

  return (
    <span className={`tabular ${className}`} aria-label={formatCents(cents, currency)}>
      {formatCents(display, currency)}
    </span>
  );
}

// Same idea for plain integers (item counts, seats paid).
export function AnimatedInt({ value, className = "" }: { value: number; className?: string }) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);

  useEffect(() => {
    if (reduced || previous.current === value) {
      previous.current = value;
      setDisplay(value);
      return;
    }
    const controls = animate(previous.current, value, {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    previous.current = value;
    return () => controls.stop();
  }, [value, reduced]);

  return <span className={`tabular ${className}`}>{display}</span>;
}
