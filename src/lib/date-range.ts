import { addDays, startOfMonthInTz, startOfTodayInTz } from "@/lib/time";

export const RANGE_PRESETS = [
  "today",
  "7d",
  "30d",
  "90d",
  "this_month",
  "last_month",
  "custom",
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const RANGE_LABELS: Record<RangePreset, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  this_month: "This month",
  last_month: "Last month",
  custom: "Custom",
};

export type ResolvedRange = { from: Date; to: Date; label: string };

// Resolves a preset (or explicit custom bounds) to a concrete [from, to)
// window in the venue's local timezone. `to` is exclusive (start of the day
// AFTER the range ends), so callers can use `paidAt: { gte: from, lt: to }`.
export function resolveRange(
  preset: RangePreset,
  timezone: string,
  custom?: { from?: string; to?: string },
): ResolvedRange {
  const todayStart = startOfTodayInTz(timezone);
  const tomorrowStart = addDays(todayStart, 1);

  switch (preset) {
    case "today":
      return { from: todayStart, to: tomorrowStart, label: "Today" };
    case "7d":
      return { from: addDays(todayStart, -6), to: tomorrowStart, label: "Last 7 days" };
    case "30d":
      return { from: addDays(todayStart, -29), to: tomorrowStart, label: "Last 30 days" };
    case "90d":
      return { from: addDays(todayStart, -89), to: tomorrowStart, label: "Last 90 days" };
    case "this_month": {
      const from = startOfMonthInTz(new Date(), timezone);
      return { from, to: tomorrowStart, label: "This month" };
    }
    case "last_month": {
      const thisMonthStart = startOfMonthInTz(new Date(), timezone);
      const lastMonthProbe = addDays(thisMonthStart, -1); // last day of prev month
      const from = startOfMonthInTz(lastMonthProbe, timezone);
      return { from, to: thisMonthStart, label: "Last month" };
    }
    case "custom": {
      const from = custom?.from ? new Date(`${custom.from}T00:00:00`) : addDays(todayStart, -29);
      const to = custom?.to ? addDays(new Date(`${custom.to}T00:00:00`), 1) : tomorrowStart;
      return { from, to, label: "Custom" };
    }
  }
}

// The immediately-preceding window of the same length, for "vs last period"
// comparisons — e.g. "last 7 days" compares against the 7 days before that.
export function priorRange(range: ResolvedRange): ResolvedRange {
  const spanMs = range.to.getTime() - range.from.getTime();
  return {
    from: new Date(range.from.getTime() - spanMs),
    to: range.from,
    label: "Previous period",
  };
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null; // "null" = no baseline to compare
  return ((current - previous) / previous) * 100;
}

// Reads ?range=&from=&to= off a page's searchParams into a validated preset
// plus its resolved window. Falls back to `defaultPreset` (default "7d", what
// Analytics/weekly-report/Invoices all use) for anything unrecognised — Order
// History passes "30d" instead, its own default per the mockup.
export function parseRangeParams(
  sp: { range?: string; from?: string; to?: string },
  timezone: string,
  defaultPreset: RangePreset = "7d",
): { preset: RangePreset; resolved: ResolvedRange } {
  const preset = (RANGE_PRESETS as readonly string[]).includes(sp.range ?? "")
    ? (sp.range as RangePreset)
    : defaultPreset;
  const resolved = resolveRange(preset, timezone, { from: sp.from, to: sp.to });
  return { preset, resolved };
}

// Plan-gated history window (entitlements.analyticsWindowDays). `null` means
// unrestricted (Growth/Pro). When the requested range starts earlier than
// the window allows, clamps `from` forward and flags that it happened so
// the page can show an "Upgrade for full history" note.
export function clampRangeToWindow(
  resolved: ResolvedRange,
  windowDays: number | null,
  timezone: string,
): { resolved: ResolvedRange; clamped: boolean } {
  if (windowDays === null) return { resolved, clamped: false };
  const todayStart = startOfTodayInTz(timezone);
  const earliestAllowed = addDays(todayStart, -(windowDays - 1));
  if (resolved.from >= earliestAllowed) return { resolved, clamped: false };
  return {
    resolved: { ...resolved, from: earliestAllowed },
    clamped: true,
  };
}

// Which fixed-length presets ("custom" excluded — it's limited via minDate
// below instead) would actually get clamped by clampRangeToWindow — used to
// grey those chips out UP FRONT rather than letting someone pick "Last 90
// days" on a 14-day plan and only finding out via the after-the-fact
// HistoryWindowNote. null (unrestricted) disables nothing.
export function disabledPresets(windowDays: number | null, timezone: string): RangePreset[] {
  if (windowDays === null) return [];
  return RANGE_PRESETS.filter((p) => {
    if (p === "custom") return false;
    const resolved = resolveRange(p, timezone);
    return clampRangeToWindow(resolved, windowDays, timezone).clamped;
  });
}

// yyyy-mm-dd floor for a custom-range <input type="date">'s `min` attribute —
// the browser's own date picker greys out anything earlier. null
// (unrestricted) means no floor.
export function earliestAllowedDateStr(windowDays: number | null, timezone: string): string | null {
  if (windowDays === null) return null;
  const todayStart = startOfTodayInTz(timezone);
  const earliest = addDays(todayStart, -(windowDays - 1));
  return earliest.toISOString().slice(0, 10);
}
