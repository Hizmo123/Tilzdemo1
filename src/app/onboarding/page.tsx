import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { PlanTier } from "@prisma/client";
import { getTenantContext } from "@/lib/auth";
import { getOnboardingDraft } from "@/lib/onboarding-draft";
import { getPendingSquareSummary } from "@/lib/square/pending";
import { INTENDED_PLAN_COOKIE } from "@/lib/onboarding-options";
import { paidPlansOpen } from "@/lib/billing";
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

  const [draft, pendingSquare, sp, jar] = await Promise.all([
    getOnboardingDraft(user.id),
    getPendingSquareSummary(user.id),
    searchParams,
    cookies(),
  ]);

  // The pricing page's "pay as you sell" intent, if any — read-only here (a
  // Server Component render can't mutate cookies). OnboardingWizard clears
  // it itself, once, after mount (see actions.ts's clearIntendedPlan).
  const cookiePlan = jar.get(INTENDED_PLAN_COOKIE)?.value as PlanTier | undefined;
  const gated = !paidPlansOpen(user.id);
  // While paid plans are closed, a fresh signup with no explicit intent lands
  // on Connect (the only plan that doesn't need the gate) instead of the
  // normal GROWTH-recommended default — see defaultOnboardingAnswers in
  // lib/onboarding-options.ts for that default; this only overrides it for
  // THIS render, same as the cookie path already does.
  const initialPlan = cookiePlan ?? (gated ? "CONNECT" : undefined);

  return (
    <OnboardingWizard
      initialDraft={draft}
      initialPlan={initialPlan}
      paidPlansOpen={!gated}
      initialSquare={pendingSquare}
      squareResult={parseSquareResult(sp)}
      returnTo="/onboarding"
    />
  );
}
