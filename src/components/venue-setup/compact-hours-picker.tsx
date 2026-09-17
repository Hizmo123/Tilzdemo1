"use client";

import { sameEveryDayHours, weekdayWeekendHours } from "@/lib/hours";

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
      <div className="grid gap-2">
        <PresetRow
          active={mode === "same"}
          onClick={() => pick("same")}
          title="Same every day"
          desc="One set of hours, every day of the week."
        />
        <PresetRow
          active={mode === "weekday_weekend"}
          onClick={() => pick("weekday_weekend")}
          title="Weekdays + weekend"
          desc="Different hours Monday–Friday vs Saturday–Sunday."
        />
        <PresetRow
          active={mode === "later"}
          onClick={() => pick("later")}
          title="I'll set this later"
          desc="Always open for now — customers can order anytime."
        />
      </div>

      {mode === "same" && (
        <TimeRange
          label="Open"
          value={weekday}
          onChange={(v) => {
            onWeekdayChange(v);
            onModeChange("same", sameEveryDayHours(v.open, v.close));
          }}
        />
      )}

      {mode === "weekday_weekend" && (
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
      )}
    </div>
  );
}

function PresetRow({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-[var(--radius-card)] border-2 p-3.5 transition-colors ${
        active ? "border-pine bg-pine-soft" : "border-line hover:border-ink/20"
      }`}
    >
      <span className="block text-sm font-medium">{title}</span>
      <span className="block text-xs text-muted mt-0.5">{desc}</span>
    </button>
  );
}

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
        value={value.open}
        onChange={(e) => onChange({ ...value, open: e.target.value })}
        className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm focus:border-pine focus:outline-none"
      />
      <span className="text-muted">–</span>
      <input
        type="time"
        value={value.close}
        onChange={(e) => onChange({ ...value, close: e.target.value })}
        className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm focus:border-pine focus:outline-none"
      />
    </div>
  );
}
