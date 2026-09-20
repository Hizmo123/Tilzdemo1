import Link from "next/link";

// Shown whenever clampRangeToWindow (lib/date-range.ts) actually shortened
// the requested range because the org's plan limits analytics history
// (entitlements.analyticsWindowDays).
export function HistoryWindowNote() {
  return (
    <p className="text-xs text-muted -mt-2">
      Your plan limits analytics history.{" "}
      <Link href="/dashboard/billing" className="text-pine hover:underline">
        Upgrade for full history
      </Link>
      .
    </p>
  );
}
