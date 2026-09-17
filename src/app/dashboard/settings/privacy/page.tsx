import Link from "next/link";
import { getAuthz } from "@/lib/auth";
import { PrivacyDataSection } from "../privacy-data-section";

export default async function PrivacySettingsPage() {
  const authz = await getAuthz();
  const organization = authz.membership?.organization;
  const restaurant = organization?.restaurants[0];

  if (!restaurant || !organization) {
    return <p className="text-muted">Create your restaurant first from the Overview page.</p>;
  }
  if (!authz.can("settings:manage")) {
    return <p className="text-muted">You don&apos;t have permission to change settings.</p>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/dashboard/settings" className="text-sm text-muted hover:text-ink">
          ← Settings
        </Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight mt-1">
          Privacy & data
        </h1>
        <p className="text-muted mt-1">
          Export your data, or request account deletion.
        </p>
      </div>

      <PrivacyDataSection
        organizationName={organization.name}
        isOwner={authz.role === "OWNER"}
        deletionRequestedAt={organization.deletionRequestedAt?.toISOString() ?? null}
      />
    </div>
  );
}
