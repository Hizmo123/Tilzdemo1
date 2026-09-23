"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AnimatedMoney } from "@/components/ui/animated-number";
import { SPRING, easeOut } from "@/components/ui/motion";

const ITEMS: [string, number][] = [
  ["Flat white", 500],
  ["Smashed avo", 1800],
  ["Bacon & egg roll", 1200],
  ["Cold brew", 600],
  ["Banana bread", 600],
];
const TOTAL = ITEMS.reduce((s, [, c]) => s + c, 0); // 4700
const PEOPLE = ["Ari", "Sam", "Jo"];
const SHARE = Math.round(TOTAL / PEOPLE.length); // 1567

// The hero visual: a Harbour Kitchen bill for Table 7 that fills in, splits
// three ways and gets paid — then does it again. Decorative, so it loops:
// nothing here waits on a real person.
//
//   phase "items" — lines stagger in and the total counts up
//   phase "split" — three shares pop in and count up from zero
//   phase "paid"  — the shares settle, the "Paid from the table" bar lands
//   (hold, fade the card out, restart)
//
// One AnimatedMoney per number keeps it to the same counting behaviour the
// real bill screen uses. Under reduced motion the finished state renders
// statically — no loop, no counting.
type Phase = "items" | "split" | "paid";

export function SplitCheck({
  loop = true,
  speed = 1,
  className = "",
}: {
  loop?: boolean;
  // <1 slows everything down (the auth panel runs it at 0.7 so it stays
  // ambient); 1 is the hero's pace.
  speed?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(reduced ? "paid" : "items");
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (reduced) {
      setPhase("paid");
      return;
    }
    const t = (ms: number) => ms / speed;
    const timers: ReturnType<typeof setTimeout>[] = [];
    setPhase("items");
    timers.push(setTimeout(() => setPhase("split"), t(1900)));
    timers.push(setTimeout(() => setPhase("paid"), t(3600)));
    if (loop) timers.push(setTimeout(() => setRun((r) => r + 1), t(7200)));
    return () => timers.forEach(clearTimeout);
  }, [reduced, run, loop, speed]);

  const splitIn = phase !== "items";
  const paid = phase === "paid";
  const d = (s: number) => s / speed;

  return (
    <div className={`relative ${className}`} aria-hidden>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={run}
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: easeOut(0.35) }}
          transition={easeOut(0.4)}
          className="rounded-[var(--radius-xl)] border border-line bg-surface shadow-float p-6 max-w-sm mx-auto lg:mx-0"
        >
          <div className="flex items-baseline justify-between border-b border-line pb-3">
            <span className="font-display text-lg font-semibold tracking-tight">Harbour Kitchen</span>
            <span className="text-sm text-muted">Table 7</span>
          </div>

          <ul className="py-3 space-y-1.5">
            {ITEMS.map(([name, cents], i) => (
              <motion.li
                key={name}
                initial={reduced ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...easeOut(0.35), delay: reduced ? 0 : d(0.25 + i * 0.16) }}
                className="flex justify-between text-sm"
              >
                <span>{name}</span>
                <span className="tabular text-muted">{money(cents)}</span>
              </motion.li>
            ))}
          </ul>

          <div className="flex justify-between border-t border-line pt-3 font-medium">
            <span>Total</span>
            <TotalCounter target={TOTAL} delay={d(0.3)} stepDelay={d(0.16)} reduced={!!reduced} />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 min-h-[58px]">
            {PEOPLE.map((who, i) => (
              <motion.div
                key={who}
                initial={reduced ? false : { opacity: 0, scale: 0.9 }}
                animate={splitIn ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
                transition={{ ...SPRING, delay: reduced ? 0 : d(i * 0.09) }}
                className={`rounded-[var(--radius-md)] text-center py-2.5 transition-colors duration-[var(--dur-base)] ${
                  paid ? "bg-success-soft text-success" : "bg-pine-soft text-pine-deep"
                }`}
              >
                <div className="text-xs flex items-center justify-center gap-1">
                  {who}
                  {paid && (
                    <svg viewBox="0 0 20 20" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <motion.path
                        d="M4 10.5l3.5 3.5L16 6"
                        initial={reduced ? false : { pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.3, delay: reduced ? 0 : d(i * 0.08) }}
                      />
                    </svg>
                  )}
                </div>
                <div className="font-semibold">
                  <AnimatedMoney cents={splitIn ? SHARE : 0} currency="AUD" duration={d(0.7)} />
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-3 min-h-[42px]">
            <AnimatePresence initial={false}>
              {paid && (
                <motion.div
                  key="paid"
                  initial={reduced ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={SPRING}
                  className="rounded-[var(--radius-md)] bg-ink text-surface text-center py-2.5 text-sm font-medium"
                >
                  Paid from the table
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// The total counts up line by line as items land, rather than in one tween
// from zero — so it reads as a running tab, not a slot machine.
function TotalCounter({
  target,
  delay,
  stepDelay,
  reduced,
}: {
  target: number;
  delay: number;
  stepDelay: number;
  reduced: boolean;
}) {
  const [shown, setShown] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced) {
      setShown(target);
      return;
    }
    setShown(0);
    let acc = 0;
    const timers = ITEMS.map(([, cents], i) =>
      setTimeout(() => {
        acc += cents;
        setShown(acc);
      }, (delay + i * stepDelay) * 1000),
    );
    return () => timers.forEach(clearTimeout);
  }, [target, delay, stepDelay, reduced]);
  return <AnimatedMoney cents={shown} currency="AUD" duration={0.3} className="font-medium" />;
}

function money(cents: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);
}
