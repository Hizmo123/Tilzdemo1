"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PlanTier } from "@prisma/client";
import { subscribe, cancelSubscription, manageBilling, setConnectPlusEnabled, setConnectBrandingHidden } from "./actions";
import {
  PLANS,
  planByTier,
  CONNECT_PLUS_PRICE_CENTS,
  CONNECT_BRANDING_REMOVAL_PRICE_CENTS,
  CONNECT_FEE_BLURB,
  centsToPriceLabel,
} from "@/lib/plans";
import { formatCents } from "@/lib/money";
import { BRAND } from "@/lib/brand";
import { isTrialableTier, TRIAL_DAYS, type TrialStatus } from "@/lib/plan-subscription";
import { PlanCardGrid, PlanCardShell, PlanFeaturesReveal, usePlanExpansion } from "@/components/ui/expandable-plan-card";

export function Billing({
  currentPlan,
  planStatus,
  squareConnected,
  connectPlusEnabled,
  connectBrandingHidden,
  trialStatus,
  paidPlansOpen,
  hasStripeSubscription,
  stripeStatus,
  currentPeriodEnd,
  cancelAtPeriodEnd,
}: {
  currentPlan: PlanTier;
  planStatus: string;
  // Active (non-revoked) SquareConnection for this venue — same bar the
  // marketing/onboarding "Connect Square" flow uses. Determines whether
  // CONNECT's button can subscribe immediately or has to detour through
  // Settings → Integrations first (see api/square/callback/route.ts's
  // connectPlanIntent, which completes the switch once that succeeds).
  squareConnected: boolean;
  // The org's two Connect-only mock addon flags — only meaningful while
  // currentPlan is CONNECT (see lib/entitlements-core.ts).
  connectPlusEnabled: boolean;
  connectBrandingHidden: boolean;
  trialStatus: TrialStatus;
  // false while LITE/GROWTH/PRO self-assignment is closed (see
  // lib/billing/gate.ts) — switching to or cancelling back to one of those
  // tiers is disabled with an "opening soon" message instead.
  paidPlansOpen: boolean;
  // True once this org has gone through a real Stripe Checkout at least
  // once (Organization.stripeSubscriptionId is set). Switches every plan
  // card's button (and the standalone cancel link) over to the Billing
  // Portal instead of a new mock/Checkout write — see manageBilling().
  hasStripeSubscription: boolean;
  // Stripe's own subscription.status string ("trialing"/"active"/
  // "past_due"/"canceled"/...), synced by the webhook — null until there's
  // ever been a real subscription. Only "past_due" changes what renders
  // here (the payment-failed banner); every other status is covered by
  // planStatus/trialStatus already.
  stripeStatus: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { expandedTier, toggle: toggleExpanded } = usePlanExpansion();

  const active = planStatus === "active";
  const paymentFailed = stripeStatus === "past_due";

  function redirectOrRefresh(res: { redirectUrl?: string }) {
    if (res.redirectUrl) {
      window.location.href = res.redirectUrl;
    } else {
      router.refresh();
    }
  }

  // Grandfathered orgs (Basic/Connect — hidden from every picker, see
  // lib/plans.ts's ALL_PLANS/PLANS split) see their own plan plus an
  // upgrade path to Growth/Pro, not Lite (downgrading to Lite is the
  // separate "Cancel and return to Lite" link above) and not every public
  // tier (a Basic org has no business seeing a Connect card or vice versa).
  // Everyone else just gets the 3 public plans, same as always.
  const isGrandfathered = currentPlan === "BASIC" || currentPlan === "CONNECT";
  const visiblePlans = isGrandfathered
    ? [planByTier(currentPlan), ...PLANS.filter((p) => p.tier !== "LITE")]
    : PLANS;

  return (
    <div className="space-y-6">
      {!hasStripeSubscription && (
        <div className="rounded-[var(--radius-sm)] bg-warn-soft text-warn text-xs px-3 py-2">
          Test mode — no card required and no real charge is made.
        </div>
      )}

      {paymentFailed && (
        <div className="rounded-[var(--radius-sm)] bg-danger/10 text-danger text-sm px-3 py-2.5 flex items-center justify-between gap-3">
          <span>
            Your last payment failed. We&apos;ll keep retrying — update your card from the billing
            portal to avoid losing access.
          </span>
        </div>
      )}

      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <p className="text-sm text-muted">Current plan</p>
        <p className="font-display text-2xl font-semibold tracking-tight mt-1">
          {planByTier(currentPlan).name}
          {active && currentPlan !== "LITE" && (
            <span className="text-sm font-normal text-pine-deep"> · active</span>
          )}
        </p>
        {trialStatus.inTrial && (
          <span className="mt-2 inline-flex items-center rounded-pill bg-pine/10 px-2.5 py-1 text-xs font-medium text-pine">
            Trial — {trialStatus.daysRemaining} day{trialStatus.daysRemaining === 1 ? "" : "s"} left
          </span>
        )}
        {currentPeriodEnd && !trialStatus.inTrial && (
          <p className="text-sm text-muted mt-2">
            {cancelAtPeriodEnd ? "Ends on " : "Renews on "}
            {currentPeriodEnd.toLocaleDateString("en-AU", { dateStyle: "medium" })}
          </p>
        )}
        {hasStripeSubscription ? (
          <button
            onClick={() =>
              start(async () => {
                const res = await manageBilling();
                redirectOrRefresh(res);
              })
            }
            disabled={pending}
            className="text-sm text-pine hover:underline mt-3"
          >
            Manage billing
          </button>
        ) : (
          active &&
          currentPlan !== "LITE" &&
          paidPlansOpen && (
            <button
              onClick={() =>
                start(async () => {
                  await cancelSubscription();
                  router.refresh();
                })
              }
              className="text-sm text-muted hover:text-danger mt-3"
            >
              Cancel and return to Lite
            </button>
          )
        )}
        {active && (currentPlan === "PRO" || currentPlan === "CONNECT") && (
          <Link
            href="/venues/new"
            className="text-sm text-pine hover:underline mt-3 inline-block"
          >
            + Add another venue
          </Link>
        )}
      </div>

      {/* visiblePlans is the 3 public plans, OR (grandfathered orgs only)
          the org's own hidden-tier card plus Growth/Pro — see above. Same
          shared PlanCardGrid the marketing pricing section uses
          (components/ui/expandable-plan-card.tsx) either way. */}
      <PlanCardGrid>
        {visiblePlans.map((p) => {
          const isCurrent = p.tier === currentPlan && active;
          const connect = p.tier === "CONNECT";
          // Connect's button can't be the same instant subscribe() every
          // other tier uses: subscribing without a working Square
          // connection would label the org CONNECT with no way to actually
          // process an order. See handleConnectClick below.
          const needsSquareFirst = connect && !squareConnected && !isCurrent;
          // An org with a real Stripe subscription switches plans through
          // the portal (Stripe handles proration) — never a second
          // Checkout Session. Only reachable for non-Connect, non-current
          // cards; Connect still goes through its own Square-first path.
          const managedByPortal = hasStripeSubscription && !connect && !isCurrent;
          // CONNECT needs no gate (no subscription to self-assign); every
          // other tier here is LITE/GROWTH/PRO, which do. A managed-by-
          // portal org is never gated — they already have a real
          // subscription, so there's nothing left to "open".
          const gated = !connect && !managedByPortal && !paidPlansOpen && !isCurrent;

          function handleSubscribeClick() {
            start(async () => {
              const res = managedByPortal ? await manageBilling() : await subscribe(p.tier);
              redirectOrRefresh(res);
            });
          }

          return (
            <PlanCardShell key={p.tier} tier={p.tier} expandedTier={expandedTier}>
            <div
              className={`relative rounded-[var(--radius-card)] border bg-surface p-6 flex flex-col h-full ${
                p.tier === "GROWTH"
                  ? "border-2 border-pine"
                  : connect
                    ? "border-pine/40 bg-pine-tint"
                    : "border-line"
              }`}
            >
              {connect && (
                <span className="absolute -top-3 left-6 text-[11px] font-semibold uppercase tracking-wide bg-surface text-pine-deep border border-pine/30 px-2.5 py-1 rounded-pill shadow-rest">
                  No subscription
                </span>
              )}
              <h3 className="font-display text-xl font-semibold tracking-tight">
                {p.name}
              </h3>
              <p className="text-sm text-muted mt-1">{p.blurb}</p>
              <p className="font-display text-3xl font-semibold tracking-tight mt-4">
                {p.priceCents === 0 ? "Free" : formatCents(p.priceCents, "AUD")}
                {p.priceCents > 0 && (
                  <span className="text-sm text-muted font-normal">
                    {" "}
                    /{p.perVenue ? "venue/mo" : "mo"} inc. GST
                  </span>
                )}
              </p>
              {connect && (
                <p className="text-xs text-pine-deep font-medium mt-1">
                  + {CONNECT_FEE_BLURB} — cancel any time
                </p>
              )}
              {paidPlansOpen && isTrialableTier(p.tier) && (
                <p className="text-xs text-pine-deep font-medium mt-1">
                  {TRIAL_DAYS}-day free trial
                </p>
              )}
              <ul className="mt-5 space-y-2 text-sm text-ink-soft flex-1">
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>

              {needsSquareFirst ? (
                <Link
                  href="/dashboard/settings/integrations?intendedPlan=CONNECT"
                  className="mt-6 h-11 rounded-[var(--radius-md)] flex items-center justify-center font-medium text-center border border-pine/40 text-pine-deep hover:bg-pine-tint transition-colors duration-[var(--dur-fast)]"
                >
                  Connect Square to switch
                </Link>
              ) : (
                <>
                  <button
                    disabled={isCurrent || gated || pending}
                    onClick={handleSubscribeClick}
                    className={`mt-6 h-11 rounded-[var(--radius-md)] font-medium transition-colors duration-[var(--dur-fast)] ${
                      isCurrent || gated
                        ? "bg-paper text-muted cursor-default"
                        : p.tier === "GROWTH"
                          ? "bg-pine text-white hover:bg-pine-deep"
                          : "border border-line hover:border-ink/30"
                    }`}
                  >
                    {isCurrent
                      ? "Current plan"
                      : gated
                        ? "Opening soon"
                        : managedByPortal
                          ? "Manage billing"
                          : "Switch to this plan"}
                  </button>
                  {gated && (
                    <a
                      href={`mailto:${BRAND.supportEmail}`}
                      className="mt-1.5 block text-center text-xs text-pine hover:underline"
                    >
                      Email us for early access
                    </a>
                  )}
                </>
              )}

              <PlanFeaturesReveal
                tier={p.tier}
                expanded={expandedTier === p.tier}
                onToggle={() => toggleExpanded(p.tier)}
              />
            </div>
            </PlanCardShell>
          );
        })}
      </PlanCardGrid>

      {currentPlan === "CONNECT" && active && (
        <ConnectAddons connectPlusEnabled={connectPlusEnabled} connectBrandingHidden={connectBrandingHidden} />
      )}

      <p className="text-xs text-muted text-center">
        Switching plans is subject to our{" "}
        <Link href="/terms" className="hover:text-ink underline underline-offset-2">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="hover:text-ink underline underline-offset-2">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}

// Beneath the Connect card, not on it — these are addons on the tier, not
// selectable plans of their own, same as how Pro's extra-venue cost is
// described as text on Pro's own card rather than a separate pricing card.
function ConnectAddons({
  connectPlusEnabled,
  connectBrandingHidden,
}: {
  connectPlusEnabled: boolean;
  connectBrandingHidden: boolean;
}) {
  const router = useRouter();

  return (
    <div className="rounded-[var(--radius-card)] border border-pine/30 bg-pine-tint p-5 space-y-1">
      <h3 className="font-display text-lg font-semibold tracking-tight">Connect addons</h3>
      <p className="text-sm text-muted mb-3">
        Mock toggles for now — no charge is made either way.
      </p>
      <AddonToggle
        label="Connect Plus"
        description="Full cross-venue dashboard — trends, comparisons and combined exports across every venue."
        priceLabel={`${centsToPriceLabel(CONNECT_PLUS_PRICE_CENTS)}/mo`}
        checked={connectPlusEnabled}
        onChange={(next) =>
          setConnectPlusEnabled(next).then(() => router.refresh())
        }
      />
      <div className="border-t border-pine/20" />
      <AddonToggle
        label={`Remove "${BRAND.poweredBy}"`}
        description={`Hides the ${BRAND.name} mark from your customer ordering page.`}
        priceLabel={`${centsToPriceLabel(CONNECT_BRANDING_REMOVAL_PRICE_CENTS)}/mo`}
        checked={connectBrandingHidden}
        onChange={(next) =>
          setConnectBrandingHidden(next).then(() => router.refresh())
        }
      />
    </div>
  );
}

function AddonToggle({
  label,
  description,
  priceLabel,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  priceLabel: string;
  checked: boolean;
  onChange: (next: boolean) => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const [value, setValue] = useState(checked);

  function toggle() {
    const next = !value;
    setValue(next);
    start(() => onChange(next));
  }

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {label} <span className="text-muted font-normal">— {priceLabel}</span>
        </p>
        <p className="text-xs text-muted mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        disabled={pending}
        onClick={toggle}
        className={`relative shrink-0 w-11 h-6 rounded-pill transition-colors duration-[var(--dur-fast)] focus:outline-none focus:ring-[3px] focus:ring-pine/20 disabled:opacity-50 ${
          value ? "bg-pine" : "bg-line-strong"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-pill bg-surface shadow-rest transition-transform duration-[var(--dur-fast)] ${
            value ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}
