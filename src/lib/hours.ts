// Opening-hours model + evaluation.
//
// Stored on Restaurant.hours as JSON: 7 entries, one per weekday (0 = Sunday).
// A day is either closed, or open between "open" and "close" ("HH:MM", venue
// local time). Overnight spans (close <= open, e.g. a bar open until 02:00) are
// supported. Null hours means "always open" (the default before it's set up).

export type DayHours = {
  day: number; // 0 = Sunday .. 6 = Saturday
  closed: boolean;
  open: string; // "HH:MM"
  close: string; // "HH:MM"
};

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function defaultHours(): DayHours[] {
  return Array.from({ length: 7 }, (_, day) => ({
    day,
    closed: false,
    open: "09:00",
    close: "17:00",
  }));
}

// Same open/close every day — the onboarding wizard's "Same every day" preset.
export function sameEveryDayHours(open: string, close: string): DayHours[] {
  return Array.from({ length: 7 }, (_, day) => ({ day, closed: false, open, close }));
}

// One range Mon-Fri, another Sat-Sun — the wizard's "Weekdays + weekend" preset.
export function weekdayWeekendHours(
  weekdayOpen: string,
  weekdayClose: string,
  weekendOpen: string,
  weekendClose: string,
): DayHours[] {
  return Array.from({ length: 7 }, (_, day) => {
    const weekend = day === 0 || day === 6;
    return {
      day,
      closed: false,
      open: weekend ? weekendOpen : weekdayOpen,
      close: weekend ? weekendClose : weekdayClose,
    };
  });
}

export function parseHours(raw: unknown): DayHours[] | null {
  if (!Array.isArray(raw) || raw.length !== 7) return null;
  const out: DayHours[] = [];
  for (let i = 0; i < 7; i++) {
    const e = raw[i] as Partial<DayHours> | undefined;
    if (!e || typeof e !== "object") return null;
    out.push({
      day: i,
      closed: !!e.closed,
      open: typeof e.open === "string" ? e.open : "09:00",
      close: typeof e.close === "string" ? e.close : "17:00",
    });
  }
  return out;
}

function toMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

// Current weekday + minute-of-day in the venue's timezone.
function nowInTz(tz: string): { day: number; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wk = get("weekday");
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0; // some environments emit 24 for midnight
  const minutes = hour * 60 + parseInt(get("minute"), 10);
  return { day: dayMap[wk] ?? 0, minutes };
}

// Is the venue open right now? Null hours = always open.
export function isOpenNow(hours: DayHours[] | null, tz: string): boolean {
  if (!hours) return true;
  const { day, minutes } = nowInTz(tz);
  const today = hours.find((h) => h.day === day);
  if (today && !today.closed) {
    const o = toMinutes(today.open);
    const c = toMinutes(today.close);
    if (c > o && minutes >= o && minutes < c) return true;
    if (c <= o && minutes >= o) return true; // overnight, before midnight
  }
  // Overnight span that started yesterday and runs past midnight into today.
  const prev = hours.find((h) => h.day === (day + 6) % 7);
  if (prev && !prev.closed) {
    const o = toMinutes(prev.open);
    const c = toMinutes(prev.close);
    if (c <= o && minutes < c) return true;
  }
  return false;
}

// Is the current venue-local time within a menu category's availability window?
// Either bound may be null (open-ended); both null = always available.
export function isWithinWindow(
  from: string | null,
  to: string | null,
  tz: string,
): boolean {
  if (!from && !to) return true;
  const { minutes } = nowInTz(tz);
  const start = from ? toMinutes(from) : 0;
  const end = to ? toMinutes(to) : 24 * 60;
  if (end > start) return minutes >= start && minutes < end;
  // Overnight window (e.g. late-night menu 22:00–02:00).
  return minutes >= start || minutes < end;
}

// "HH:MM" (24h) → "9:00 am" style for display.
export function formatTime(hhmm: string): string {
  const mins = toMinutes(hhmm);
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h24 < 12 ? "am" : "pm";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}
