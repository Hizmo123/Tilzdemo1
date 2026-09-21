import Link from "next/link";
import { getAuthz } from "@/lib/auth";
import { Billing } from "./checkout";

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Billing
        </h1>
        <p className="text-muted mt-1">
          Switch your plan to test how each tier behaves. Test mode — no card
          required and no charge is made.
        </p>
      </div>

      <Billing currentPlan={org.plan} planStatus={org.planStatus} />
    </div>
  );
}
