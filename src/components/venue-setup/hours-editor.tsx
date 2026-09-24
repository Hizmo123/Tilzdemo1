"use client";

import { DAY_NAMES, type DayHours } from "@/lib/hours";

// Day-by-day opening-hours editor. Shared by the Settings appearance page and
// the onboarding wizard's "Service hours" step so the two never fork.
export function HoursEditor({
  value,
  onChange,
}: {
  value: DayHours[];
  onChange: (next: DayHours[]) => void;
}) {
  function setDay(day: number, patch: Partial<DayHours>) {
    onChange(value.map((h) => (h.day === day ? { ...h, ...patch } : h)));
  }

  return (
    <div className="space-y-1.5">
      {value.map((h) => (
        <div key={h.day} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0">{DAY_NAMES[h.day]}</span>
          <label className="flex items-center gap-1.5 text-muted">
            <input
              type="checkbox"
              checked={h.closed}
              onChange={(e) => setDay(h.day, { closed: e.target.checked })}
              className="accent-pine w-3.5 h-3.5"
            />
            Closed
          </label>
          {!h.closed && (
            <>
              <input
                type="time"
                value={h.open}
                onChange={(e) => setDay(h.day, { open: e.target.value })}
                className="rounded-[var(--radius-xs)] border border-line bg-surface px-2 py-1 text-sm focus:border-pine focus:outline-none"
              />
              <span className="text-muted">–</span>
              <input
                type="time"
                value={h.close}
                onChange={(e) => setDay(h.day, { close: e.target.value })}
                className="rounded-[var(--radius-xs)] border border-line bg-surface px-2 py-1 text-sm focus:border-pine focus:outline-none"
              />
            </>
          )}
        </div>
      ))}
    </div>
  );
}
