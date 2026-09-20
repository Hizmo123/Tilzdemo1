import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { canCreateVenue } from "@/lib/entitlements";
import { AddVenueFlow } from "./add-venue-flow";

export const dynamic = "force-dynamic";

export default async function AddVenuePage() {
  const { membership } = await getTenantContext();
  if (!membership) redirect("/onboarding");

  // The real authority — re-checked again inside
  // completeOnboardingForExistingOrg before anything is actually written,
  // so this page's own read is only for deciding what to SHOW, never the
  // only thing standing between a blocked org and a new venue.
  const check = await canCreateVenue(membership.organizationId);

  if (!check.allowed) {
    return (
      <main className="min-h-dvh bg-paper flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-display text-xl font-semibold tracking-tight">
            Upgrade to Pro to run multiple venues
          </h1>
          <p className="text-sm text-muted mt-2">{check.reason}</p>
          <Link
            href="/dashboard/billing"
            className="mt-5 inline-block rounded-lg bg-pine text-white px-4 py-2.5 text-sm font-medium hover:bg-pine-deep"
          >
            See plans
          </Link>
        </div>
      </main>
    );
  }

  return (
    <AddVenueFlow
      organizationId={membership.organizationId}
      requiresPayment={"requiresPayment" in check && check.requiresPayment === true}
      addonPriceLabel={"addonPriceLabel" in check ? check.addonPriceLabel : undefined}
    />
  );
}
