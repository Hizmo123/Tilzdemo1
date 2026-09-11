// Timezone-aware "start of today" for a given IANA timezone (e.g.
// "Australia/Sydney"). "Today's sales" must reset at the restaurant's local
// midnight, not the server's — otherwise a venue in Sydney sees the day roll
// over at the wrong time. Uses Intl to read the local wall-clock date, then
// derives the UTC instant of that local midnight.
export function startOfTodayInTz(timeZone: string): Date {
  const now = new Date();
  // Wall-clock Y-M-D in the target timezone.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const y = get("year");
  const m = get("month");
  const d = get("day");

  // Find the UTC instant that reads as local midnight by measuring the tz offset
  // at this moment via a formatted comparison.
  const localMidnightAsUtc = new Date(`${y}-${m}-${d}T00:00:00Z`);
  // Offset (ms) between the target tz and UTC at `now`.
  const asTz = new Date(
    now.toLocaleString("en-US", { timeZone }),
  ).getTime();
  const asUtc = new Date(now.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  const offsetMs = asTz - asUtc;

  return new Date(localMidnightAsUtc.getTime() - offsetMs);
}
