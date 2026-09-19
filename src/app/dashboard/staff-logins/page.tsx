import { redirect } from "next/navigation";

// Folded into the Team tabset (see /dashboard/staff) — kept as a redirect so
// no existing link (setup checklist, kitchen page, bookmarks) breaks.
export default function StaffLoginsRedirect() {
  redirect("/dashboard/staff/logins");
}
