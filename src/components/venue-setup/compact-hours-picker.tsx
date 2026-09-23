"use client";

import { AnimatePresence, motion } from "motion/react";
import { sameEveryDayHours, weekdayWeekendHours } from "@/lib/hours";
import { ChoiceCard } from "./choice";

export type HoursPresetMode = "same" | "weekday_weekend" | "later";

// Onboarding's fast opening-hours step: three presets, a one- or two-row
// editor for the first two. The full day-by-day HoursEditor (used in Settings)
// is always available afterwards for anyone who needs finer control.
export function CompactHoursPicker({
  mode,
  onModeChange,
  weekday,
  onWeekdayChange,
  weekend,
  onWeekendChange,
}: {
  mode: HoursPresetMode;
  onModeChange: (mode: HoursPresetMode, hours: import("@/lib/hours").DayHours[] | null) => void;
  weekday: { open: string; close: string };
  onWeekdayChange: (v: { open: string; close: string }) => void;
  weekend: { open: string; close: string };
  onWeekendChange: (v: { open: string; close: string }) => void;
}) {
  function pick(next: HoursPresetMode) {
    if (next === "same") onModeChange(next, sameEveryDayHours(weekday.open, weekday.close));
    else if (next === "weekday_weekend")
      onModeChange(
        next,
        weekdayWeekendHours(weekday.open, weekday.close, weekend.open, weekend.close),
      );
    else onModeChange(next, null);
  }

  return (
    <div className="space-y-3">
      <div role="radiogroup" className="grid gap-2">
        <ChoiceCard
          selected={mode === "same"}
          onClick={() => pick("same")}
          title="Same every day"
          desc="One set of hours, every day of the week."
        />
        <ChoiceCard
          selected={mode === "weekday_weekend"}
          onClick={() => pick("weekday_weekend")}
          title="Weekdays + weekend"
          desc="Different hours Monday–Friday vs Saturday–Sunday."
        />
        <ChoiceCard
          selected={mode === "later"}
          onClick={() => pick("later")}
          title="I'll set this later"
          desc="Always open for now — customers can order anytime."
        />
      </div>

      <AnimatePresence initial={false} mode="wait">
        {mode === "same" && (
          <Reveal key="same">
            <TimeRange
              label="Open"
              value={weekday}
              onChange={(v) => {
                onWeekdayChange(v);
                onModeChange("same", sameEveryDayHours(v.open, v.close));
              }}
            />
          </Reveal>
        )}

        {mode === "weekday_weekend" && (
          <Reveal key="split">
            <div className="space-y-3">
              <TimeRange
                label="Monday – Friday"
                value={weekday}
                onChange={(v) => {
                  onWeekdayChange(v);
                  onModeChange(
                    "weekday_weekend",
                    weekdayWeekendHours(v.open, v.close, weekend.open, weekend.close),
                  );
                }}
              />
              <TimeRange
                label="Saturday – Sunday"
                value={weekend}
                onChange={(v) => {
                  onWeekendChange(v);
                  onModeChange(
                    "weekday_weekend",
                    weekdayWeekendHours(weekday.open, weekday.close, v.open, v.close),
                  );
                }}
              />
            </div>
          </Reveal>
        )}
      </AnimatePresence>
    </div>
  );
}

function Reveal({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="rounded-[var(--radius-card)] border border-line bg-surface shadow-rest p-3.5"
    >
      {children}
    </motion.div>
  );
}

const TIME_INPUT =
  "h-10 rounded-[var(--radius-sm)] border border-line bg-surface px-2.5 text-sm shadow-rest focus:outline-none focus:border-pine focus:ring-[3px] focus:ring-pine/20 transition-[border-color,box-shadow] duration-[var(--dur-fast)]";

function TimeRange({
  label,
  value,
  onChange,
}: {
  label: string;
  value: { open: string; close: string };
  onChange: (v: { open: string; close: string }) => void;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 text-muted">{label}</span>
      <input
        type="time"
        aria-label={`${label} opens`}
        value={value.open}
        onChange={(e) => onChange({ ...value, open: e.target.value })}
        className={TIME_INPUT}
      />
      <span className="text-muted">–</span>
      <input
        type="time"
        aria-label={`${label} closes`}
        value={value.close}
        onChange={(e) => onChange({ ...value, close: e.target.value })}
        className={TIME_INPUT}
      />
    </div>
  );
}
