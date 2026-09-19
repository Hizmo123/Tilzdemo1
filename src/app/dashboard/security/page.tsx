import { redirect } from "next/navigation";

// Folded into Settings (see /dashboard/settings) — kept as a redirect so no
// existing link or bookmark breaks.
export default function SecurityRedirect() {
  redirect("/dashboard/settings/security");
}
