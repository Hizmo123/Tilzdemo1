import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { getOnboardingDraft } from "@/lib/onboarding-draft";
import { OnboardingWizard } from "./onboarding-wizard";

export const dynamic = "force-dynamic";

// First-run setup. A signed-in user with no venue yet answers a few questions
// that build their store; anyone who already has one is sent to the
// dashboard — unchanged from before, so the existing membership-without-a-
// restaurant edge case (handled by CreateRestaurantForm on /dashboard) still
// behaves exactly as it did.
export default async function OnboardingPage() {
  const { user, membership } = await getTenantContext();
  if (membership) redirect("/dashboard");

  const draft = await getOnboardingDraft(user.id);

  return <OnboardingWizard initialDraft={draft} />;
}
