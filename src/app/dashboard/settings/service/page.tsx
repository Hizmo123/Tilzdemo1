import Link from "next/link";
import { getAuthz } from "@/lib/auth";
import { SettingsForm } from "../settings-form";
import { buildSettingsInitial } from "../settings-initial";
import { VenueSetupForm } from "../venue-setup/venue-setup-form";

export default async function ServiceModelPage() {
  const authz = await getAuthz();
  const restaurant = authz.membership?.organization.restaurants[0];

  if (!restaurant) {
    return <p className="text-muted">Create your restaurant first from the Overview page.</p>;
  }
  if (!authz.can("settings:manage")) {
    return <p className="text-muted">You don&apos;t have permission to change settings.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/settings" className="text-sm text-muted hover:text-ink">
          ← Settings
        </Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight mt-1">
          Service model
        </h1>
        <p className="text-muted mt-1">
          Ordering, payment timing, surcharge, tipping and POS.
        </p>
      </div>

      <SettingsForm section="service" initial={buildSettingsInitial(restaurant)} />

      {/* Venue type / service style / experience mode / split methods / Square —
          the onboarding questions, kept as their own form (own save button,
          own action) exactly as before; just relocated onto this page instead
          of a separate hidden /dashboard/settings/venue-setup route. */}
      <div className="max-w-2xl">
        <VenueSetupForm
          initial={{
            venueType: restaurant.venueType ?? "cafe",
            experienceMode: restaurant.experienceMode ?? "custom",
            customerOrdering: restaurant.customerOrdering,
            customerPayment: restaurant.customerPayment,
            paymentTiming: restaurant.paymentTiming as "before" | "after",
            staffApproval: restaurant.staffApproval,
            splitMethods: restaurant.splitMethods,
            posProvider: restaurant.posProvider,
            posProviderOther: restaurant.posProviderOther ?? "",
            squareConnectInterest: restaurant.squareConnectInterest,
          }}
        />
      </div>
    </div>
  );
}
