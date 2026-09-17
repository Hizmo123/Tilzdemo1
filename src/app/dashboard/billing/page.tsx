import Link from "next/link";
import { getAuthz } from "@/lib/auth";
import { Billing } from "./checkout";

// The checkout flow below (./checkout.tsx) collects a raw card number into a
// plain form and writes the plan straight onto the Organization row — a mock
// built to exercise the signup -> choose plan -> pay journey end to end before
// real Stripe Billing exists. That's fine in a dev sandbox; it's a PCI and
// liability problem on a live deployment where a real person could type a
// real card number into it. Gated OFF by default — only an explicit
// BILLING_UI_ENABLED=true unlocks it, and that flag should stay off until
// Stripe Billing (Delivery 2) replaces this component outright.
const BILLING_UI_ENABLED = process.env.BILLING_UI_ENABLED === "true";

export default async function BillingPage() {
  const authz = await getAuthz();
  const org = authz.membership?.organization;

  if (!org) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Billing
        </h1>
        <p className="text-muted">
          Create your restaurant first from the{" "}
          <Link href="/dashboard" className="text-pine hover:underline">
            Overview
          </Link>{" "}
          page.
        </p>
      </div>
    );
  }

  if (!authz.can("settings:manage")) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Billing
        </h1>
        <p className="text-muted">Only an owner or admin can manage billing.</p>
      </div>
    );
  }

  if (!BILLING_UI_ENABLED) {
    return (
      <div className="space-y-4 max-w-lg">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Billing
        </h1>
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
          <p className="font-medium">Billing is coming soon.</p>
          <p className="text-sm text-muted mt-1.5">
            You're on the <strong className="text-ink">Free</strong> plan for
            now — everything you're using keeps working. Real plans and
            secure card payment (via Stripe) land here shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Billing
        </h1>
        <p className="text-muted mt-1">
          Choose a plan. Payments here are in test mode — no real charge yet.
        </p>
      </div>

      <Billing
        currentPlan={org.plan}
        planStatus={org.planStatus}
        cardLast4={org.cardLast4}
      />
    </div>
  );
}
