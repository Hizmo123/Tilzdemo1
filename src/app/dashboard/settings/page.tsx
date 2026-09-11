import Link from "next/link";
import { getAuthz } from "@/lib/auth";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const authz = await getAuthz();
  const restaurant = authz.membership?.organization.restaurants[0];

  if (!restaurant) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Settings
        </h1>
        <p className="text-muted">
          Create your restaurant first from the{" "}
          <Link href="/dashboard" className="text-pine hover:underline">
            Overview
          </Link>{" "}
          page.
        </p>
      </div>
    );
  }

  if (!authz.can("settings:manage")) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Settings
        </h1>
        <p className="text-muted">You don&apos;t have permission to change settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Settings
        </h1>
        <p className="text-muted mt-1">
          Venue details, branding and tipping.
        </p>
      </div>

      <SettingsForm
        initial={{
          name: restaurant.name,
          abn: restaurant.abn,
          timezone: restaurant.timezone,
          currency: restaurant.currency,
          brandColor: restaurant.brandColor,
          theme: restaurant.theme,
          themeMode: restaurant.themeMode,
          fontTheme: restaurant.fontTheme,
          logoUrl: restaurant.logoUrl,
          coverUrl: restaurant.coverUrl,
          bgImageUrl: restaurant.bgImageUrl,
          tipEnabled: restaurant.tipEnabled,
          tipPresets: restaurant.tipPresets,
          customerOrdering: restaurant.customerOrdering,
          customerPayment: restaurant.customerPayment,
          staffApproval: restaurant.staffApproval,
          paymentTiming: restaurant.paymentTiming,
          takeawayEnabled: restaurant.takeawayEnabled,
          hours: restaurant.hours,
          slug: restaurant.slug,
          ownerPhone: restaurant.ownerPhone,
        }}
      />
    </div>
  );
}
