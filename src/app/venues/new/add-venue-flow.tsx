"use client";

import { useState } from "react";
import type { PlanTier } from "@prisma/client";
import { OnboardingWizard } from "@/app/onboarding/onboarding-wizard";
import type { SquareResult } from "@/app/onboarding/square-result";
import type { OnboardingDraftPayload } from "@/lib/onboarding-options";
import type { PendingSquareSummary, OrgSquareConnectionSummary } from "@/lib/square/pending";
import { Button } from "@/components/ui/button";

// Gates entry into the (reused) onboarding wizard behind a mock payment
// confirmation when canCreateVenue said requiresPayment — see
// venues/new/page.tsx, which computes that server-side and never trusts a
// client-side decision alone (completeOnboardingForExistingOrg re-checks
// canCreateVenue itself before ever writing anything). No payment provider
// is called here or anywhere in this flow.
export function AddVenueFlow({
  organizationId,
  orgPlan,
  requiresPayment,
  addonPriceLabel,
  initialDraft,
  initialSquare,
  existingOrgSquare,
  squareResult,
  skipConfirm,
}: {
  organizationId: string;
  orgPlan: PlanTier;
  requiresPayment: boolean;
  addonPriceLabel?: string;
  initialDraft: OnboardingDraftPayload | null;
  initialSquare: PendingSquareSummary | null;
  // Task 5: an existing, live SquareConnection elsewhere in this org, if
  // any — lets the Payments step offer "Use <merchant>" instead of a fresh
  // OAuth click-through.
  existingOrgSquare: OrgSquareConnectionSummary | null;
  squareResult: SquareResult | null;
  skipConfirm: boolean;
}) {
  const [confirmed, setConfirmed] = useState(!requiresPayment || skipConfirm);

  if (!confirmed) {
    return (
      <main className="min-h-dvh bg-paper flex items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-surface shadow-rest p-6 text-center">
          <h1 className="font-display text-xl font-semibold tracking-tight">
            Add a 4th venue
          </h1>
          <p className="text-sm text-muted mt-2">
            Pro includes 3 venues. This one adds{" "}
            <span className="font-medium text-ink">{addonPriceLabel}</span> to
            your subscription.
          </p>
          <p className="text-xs text-muted mt-2">
            Billing is mock for now — nothing is actually charged.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <Button onClick={() => setConfirmed(true)}>Confirm — add venue</Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <OnboardingWizard
      initialDraft={initialDraft}
      organizationId={organizationId}
      fixedPlan={orgPlan}
      initialSquare={initialSquare}
      existingOrgSquare={existingOrgSquare}
      squareResult={squareResult}
      returnTo="/venues/new"
    />
  );
}
