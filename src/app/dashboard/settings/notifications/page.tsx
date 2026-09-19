import Link from "next/link";
import { getAuthz } from "@/lib/auth";
import { SettingsForm } from "../settings-form";
import { buildSettingsInitial } from "../settings-initial";

export default async function NotificationsSettingsPage() {
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
          Notifications
        </h1>
        <p className="text-muted mt-1">Kitchen chime.</p>
      </div>

      <SettingsForm section="notifications" initial={buildSettingsInitial(restaurant)} />
    </div>
  );
}
