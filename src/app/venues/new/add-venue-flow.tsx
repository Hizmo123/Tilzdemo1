"use client";

import { useState } from "react";
import { OnboardingWizard } from "@/app/onboarding/onboarding-wizard";

// Gates entry into the (reused, unmodified) onboarding wizard behind a mock
// payment confirmation when canCreateVenue said requiresPayment — see
// venues/new/page.tsx, which computes that server-side and never trusts a
// client-side decision alone (completeOnboardingForExistingOrg re-checks
// canCreateVenue itself before ever writing anything). No payment provider
// is called here or anywhere in this flow.
export function AddVenueFlow({
  organizationId,
  requiresPayment,
  addonPriceLabel,
}: {
  organizationId: string;
  requiresPayment: boolean;
  addonPriceLabel?: string;
}) {
  const [confirmed, setConfirmed] = useState(!requiresPayment);

  if (!confirmed) {
    return (
      <main className="min-h-dvh bg-paper flex items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-surface p-6 text-center">
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
            <button
              onClick={() => setConfirmed(true)}
              className="rounded-lg bg-pine text-white px-4 py-2.5 text-sm font-medium hover:bg-pine-deep"
            >
              Confirm — add venue
            </button>
          </div>
        </div>
      </main>
    );
  }

  return <OnboardingWizard initialDraft={null} organizationId={organizationId} />;
}
