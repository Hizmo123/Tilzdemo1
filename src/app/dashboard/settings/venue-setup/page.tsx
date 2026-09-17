import { redirect } from "next/navigation";

// Venue setup now lives on the Service model page inside the settings hub
// (/dashboard/settings/service) rather than this separate, hard-to-find
// route — see the settings hub restructure. The form itself (venue-setup-form.tsx)
// and its action (actions.ts) are unchanged and still used from there.
export default function VenueSetupRedirect() {
  redirect("/dashboard/settings/service");
}
