import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { OnboardingWizard } from "./onboarding-wizard";

export const dynamic = "force-dynamic";

// First-run setup. A signed-in user with no venue yet answers a few questions
// that build their store; anyone who already has one is sent to the dashboard.
export default async function OnboardingPage() {
  const { membership } = await getTenantContext();
  if (membership) redirect("/dashboard");

  return <OnboardingWizard />;
}
