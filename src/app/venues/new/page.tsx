import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { canCreateVenue } from "@/lib/entitlements";
import { getOnboardingDraft } from "@/lib/onboarding-draft";
import { getPendingSquareSummary } from "@/lib/square/pending";
import { parseSquareResult } from "@/app/onboarding/square-result";
import { AddVenueFlow } from "./add-venue-flow";

export const dynamic = "force-dynamic";

export default async function AddVenuePage({
  searchParams,
}: {
  searchParams: Promise<{ square?: string; reason?: string }>;
}) {
  const { user, membership } = await getTenantContext();
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

  // Same resume machinery as first-run onboarding: the wizard saves a draft
  // before leaving for Square OAuth and picks it back up on return here.
  const [draft, pendingSquare, sp] = await Promise.all([
    getOnboardingDraft(user.id),
    getPendingSquareSummary(user.id),
    searchParams,
  ]);
  const squareResult = parseSquareResult(sp);

  return (
    <AddVenueFlow
      organizationId={membership.organizationId}
      orgPlan={membership.organization.plan}
      requiresPayment={"requiresPayment" in check && check.requiresPayment === true}
      addonPriceLabel={"addonPriceLabel" in check ? check.addonPriceLabel : undefined}
      initialDraft={draft}
      initialSquare={pendingSquare}
      squareResult={squareResult}
      // Coming back from Square means they already confirmed the add-on
      // (if any) before they left — don't make them confirm it twice.
      skipConfirm={squareResult !== null || draft !== null}
    />
  );
}
