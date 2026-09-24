"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PlanTier } from "@prisma/client";
import { subscribe, cancelSubscription, setConnectPlusEnabled, setConnectBrandingHidden } from "./actions";
import {
  PLANS,
  CONNECT_PLUS_PRICE_CENTS,
  CONNECT_BRANDING_REMOVAL_PRICE_CENTS,
  centsToPriceLabel,
} from "@/lib/plans";
import { formatCents } from "@/lib/money";
import { isTrialableTier, TRIAL_DAYS, type TrialStatus } from "@/lib/plan-subscription";
import { PlanCardShell, PlanFeaturesReveal, usePlanExpansion } from "@/components/ui/expandable-plan-card";

export function Billing({
  currentPlan,
  planStatus,
  squareConnected,
  connectPlusEnabled,
  connectBrandingHidden,
  trialStatus,
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
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { expandedTier, toggle: toggleExpanded } = usePlanExpansion();

  const active = planStatus === "active";

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-amber-50 text-amber-800 text-xs px-3 py-2">
        Test mode — no card required and no real charge is made.
      </div>

      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <p className="text-sm text-muted">Current plan</p>
        <p className="font-display text-2xl font-semibold tracking-tight mt-1">
          {PLANS.find((p) => p.tier === currentPlan)?.name ?? "Lite"}
          {active && currentPlan !== "LITE" && (
            <span className="text-sm font-normal text-pine-deep"> · active</span>
          )}
        </p>
        {trialStatus.inTrial && (
          <span className="mt-2 inline-flex items-center rounded-full bg-pine/10 px-2.5 py-1 text-xs font-medium text-pine">
            Trial — {trialStatus.daysRemaining} day{trialStatus.daysRemaining === 1 ? "" : "s"} left
          </span>
        )}
        {active && currentPlan !== "LITE" && (
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

      {/* Rendered straight from PLANS, same responsive breakpoints as the
          marketing pricing grid (src/app/page.tsx) so both handle the 5
          tiers (Connect added) identically — 3-then-2 from lg up, all 5 in
          one row only once there's genuinely room for it. A flex row (not
          CSS grid) so PlanCardShell's per-card flex-basis can grow the
          expanded card and squeeze its siblings — see
          components/ui/expandable-plan-card.tsx. */}
      <div className="flex flex-wrap gap-4">
        {PLANS.map((p) => {
          const isCurrent = p.tier === currentPlan && active;
          const connect = p.tier === "CONNECT";
          // Connect's button can't be the same instant subscribe() every
          // other tier uses: subscribing without a working Square
          // connection would label the org CONNECT with no way to actually
          // process an order. See handleConnectClick below.
          const needsSquareFirst = connect && !squareConnected && !isCurrent;

          function handleSubscribeClick() {
            start(async () => {
              await subscribe(p.tier);
              router.refresh();
            });
          }

          return (
            <PlanCardShell key={p.tier} tier={p.tier} expandedTier={expandedTier}>
            <div
              className={`relative rounded-2xl border bg-surface p-6 flex flex-col h-full ${
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
                    /{p.perVenue ? "venue/mo" : "mo"}
                  </span>
                )}
              </p>
              {connect && (
                <p className="text-xs text-pine-deep font-medium mt-1">
                  + ~2% per order — cancel any time
                </p>
              )}
              {isTrialableTier(p.tier) && (
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
                  className="mt-6 rounded-xl py-3 font-medium text-center border border-pine/40 text-pine-deep hover:bg-pine-tint"
                >
                  Connect Square to switch
                </Link>
              ) : (
                <button
                  disabled={isCurrent || pending}
                  onClick={handleSubscribeClick}
                  className={`mt-6 rounded-xl py-3 font-medium ${
                    isCurrent
                      ? "bg-paper text-muted cursor-default"
                      : p.tier === "GROWTH"
                        ? "bg-pine text-white hover:bg-pine-deep"
                        : "border border-line hover:border-ink/30"
                  }`}
                >
                  {isCurrent ? "Current plan" : "Switch to this plan"}
                </button>
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
      </div>

      {currentPlan === "CONNECT" && active && (
        <ConnectAddons connectPlusEnabled={connectPlusEnabled} connectBrandingHidden={connectBrandingHidden} />
      )}
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
        label='Remove "Powered by Tillz"'
        description="Hides the Tillz mark from your customer ordering page."
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
