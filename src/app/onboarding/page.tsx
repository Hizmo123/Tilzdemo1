import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { getOnboardingDraft } from "@/lib/onboarding-draft";
import { getPendingSquareSummary } from "@/lib/square/pending";
import { OnboardingWizard } from "./onboarding-wizard";
import { parseSquareResult } from "./square-result";

export const dynamic = "force-dynamic";

// First-run setup. A signed-in user with no venue yet answers a few questions
// that build their store; anyone who already has one is sent to the
// dashboard — unchanged from before, so the existing membership-without-a-
// restaurant edge case (handled by CreateRestaurantForm on /dashboard) still
// behaves exactly as it did.
//
// ?square=success|error&reason=… is the Square OAuth round trip landing back
// here (see /api/square/callback's onboarding flow); the wizard resumes at
// its Payments step from the draft saved just before it left.
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ square?: string; reason?: string }>;
}) {
  const { user, membership } = await getTenantContext();
  if (membership) redirect("/dashboard");

  const [draft, pendingSquare, sp] = await Promise.all([
    getOnboardingDraft(user.id),
    getPendingSquareSummary(user.id),
    searchParams,
  ]);

  return (
    <OnboardingWizard
      initialDraft={draft}
      initialSquare={pendingSquare}
      squareResult={parseSquareResult(sp)}
      returnTo="/onboarding"
    />
  );
}
