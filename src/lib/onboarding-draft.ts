import { prisma } from "@/lib/prisma";
import type { OnboardingDraftPayload } from "@/lib/onboarding-options";

// Reads a user's in-progress wizard answers, if any. Plain read-only helper
// (not a server action) so the onboarding page can call it directly like any
// other server-component data fetch.
export async function getOnboardingDraft(
  userId: string,
): Promise<OnboardingDraftPayload | null> {
  const row = await prisma.onboardingDraft.findUnique({ where: { userId } });
  return (row?.answers as OnboardingDraftPayload | undefined) ?? null;
}
