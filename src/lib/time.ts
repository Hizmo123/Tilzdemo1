// Timezone-aware date maths for a given IANA timezone (e.g.
// "Australia/Sydney"). Revenue windows ("today", "this week", "this month")
// must reset at the restaurant's local boundary, not the server's — derived
// from Intl by reading the local wall-clock date, then finding the UTC
// instant that corresponds to that local midnight.

// The UTC instant of local midnight on the day `date` falls on, in `timeZone`.
export function startOfDayInTz(date: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const y = get("year");
  const m = get("month");
  const d = get("day");

  const localMidnightAsUtc = new Date(`${y}-${m}-${d}T00:00:00Z`);
  // Offset (ms) between the target tz and UTC at `date`.
  const asTz = new Date(date.toLocaleString("en-US", { timeZone })).getTime();
  const asUtc = new Date(date.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  const offsetMs = asTz - asUtc;

  return new Date(localMidnightAsUtc.getTime() - offsetMs);
}

export function startOfTodayInTz(timeZone: string): Date {
  return startOfDayInTz(new Date(), timeZone);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

// Monday 00:00 local time of the ISO week `date` falls in.
export function startOfWeekInTz(date: Date, timeZone: string): Date {
  const wk = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  const daysFromMonday = (WEEKDAY_INDEX[wk] + 6) % 7; // Mon=0 .. Sun=6
  return addDays(startOfDayInTz(date, timeZone), -daysFromMonday);
}

// The 1st of the local-calendar month `date` falls in, at local midnight.
export function startOfMonthInTz(date: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  // Noon UTC on the 1st is safely within the 1st in any timezone, so deriving
  // that day's local midnight from it is unambiguous.
  return startOfDayInTz(new Date(`${y}-${m}-01T12:00:00Z`), timeZone);
}

// ISO week number (1-53) + week-year for `date` in `timeZone`. Used to label
// and group the weekly revenue report by calendar week.
export function isoWeekInfo(date: Date, timeZone: string): { year: number; week: number } {
  const monday = startOfWeekInTz(date, timeZone);
  // ISO week 1 is the week containing the first Thursday of the year.
  const thursday = addDays(monday, 3);
  const y = thursday.getUTCFullYear();
  const jan1 = new Date(Date.UTC(y, 0, 1));
  const jan1Weekday = (jan1.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  const week1Monday = addDays(jan1, -jan1Weekday);
  const week = Math.round((monday.getTime() - week1Monday.getTime()) / (7 * 86_400_000)) + 1;
  return { year: y, week };
}
