import { redirect } from "next/navigation";

// Folded into the Team tabset (see /dashboard/staff) — kept as a redirect so
// no existing link or bookmark breaks.
export default function ActivityRedirect() {
  redirect("/dashboard/staff/activity");
}
