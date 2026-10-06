"use client";

import { PLANS, planPriceLabel, PAY_AS_YOU_SELL_BLURB, type PlanDef } from "@/lib/plans";
import { isTrialableTier, TRIAL_DAYS } from "@/lib/plan-subscription";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlanCardGrid, PlanCardShell, PlanFeaturesReveal, usePlanExpansion } from "@/components/ui/expandable-plan-card";

// The tier we lead with. Growth is the plan a venue going live across the
// whole floor actually lands on — no table cap, no "Powered by Tap-to-It" on
// their ordering page — so it's the one we mark "Most popular".
const RECOMMENDED_TIER: PlanDef["tier"] = "GROWTH";

// Client component (the "Full features" expand/squeeze interaction needs
// state) rendered from the marketing homepage's server component (Pricing()
// in src/app/page.tsx), which keeps everything around it — the section
// intro, the "Prices in AUD…" footnote — server-rendered.
export function PricingGrid() {
  const { expandedTier, toggle: toggleExpanded } = usePlanExpansion();

  return (
    <>
      {/* Same grid, same interaction, same component as the dashboard
          Billing grid (components/ui/expandable-plan-card.tsx). PlanCardShell
          must be a DIRECT grid child for its col-span/layout animation to
          apply, so — unlike the rest of this page — this grid doesn't route
          through RevealGroup/RevealItem (that scroll-triggered stagger needs
          to own the same element). */}
      <PlanCardGrid className="mt-10 pt-3">
        {PLANS.map((plan) => (
          <PlanCardShell key={plan.tier} tier={plan.tier} expandedTier={expandedTier}>
            <PricingCard
              plan={plan}
              expanded={expandedTier === plan.tier}
              onToggleExpand={() => toggleExpanded(plan.tier)}
            />
          </PlanCardShell>
        ))}
      </PlanCardGrid>

      <PayAsYouSellStrip />
    </>
  );
}

function PricingCard({
  plan,
  expanded,
  onToggleExpand,
}: {
  plan: PlanDef;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const free = plan.priceCents === 0;
  const recommended = plan.tier === RECOMMENDED_TIER;
  return (
    <Card
      elevation={recommended ? "raised" : "rest"}
      className={`relative flex flex-col p-6 h-full ${
        recommended ? "ring-2 ring-pine" : free ? "bg-surface-2/60" : ""
      }`}
    >
      {recommended && (
        <span className="absolute -top-3 left-6 text-[11px] font-semibold uppercase tracking-wide bg-accent-gradient text-on-accent px-2.5 py-1 rounded-pill shadow-accent">
          Most popular
        </span>
      )}
      <h3 className="font-display text-display-sm font-semibold">{plan.name}</h3>
      <p className="mt-1 text-sm text-muted min-h-[40px]">{plan.blurb}</p>
      <p className="mt-5 font-display text-display font-semibold">
        {planPriceLabel(plan)}
        {plan.cadence === "per month" && (
          <span className="text-base text-muted font-normal font-sans tracking-normal"> /month</span>
        )}
      </p>
      {plan.cadence === "free" && <p className="text-xs text-muted mt-1">No card needed</p>}
      {isTrialableTier(plan.tier) && (
        <p className="text-xs text-pine-deep font-medium mt-1">{TRIAL_DAYS}-day free trial</p>
      )}
      <ul className="mt-6 space-y-2.5 text-sm text-ink-soft flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <svg viewBox="0 0 20 20" className="w-4 h-4 mt-0.5 shrink-0 text-pine" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 10.5l3.5 3.5L16 6" />
            </svg>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-7">
        <LinkButton href="/signup" variant={recommended ? "primary" : "secondary"} full>
          {free ? "Start free" : `Choose ${plan.name}`}
        </LinkButton>
      </div>

      <PlanFeaturesReveal tier={plan.tier} expanded={expanded} onToggle={onToggleExpand} />
    </Card>
  );
}

// Connect isn't a 4th card alongside the 3 subscription tiers — it's a
// different pricing model (no monthly fee, a per-order cut instead), so it
// gets a full-width strip below them rather than competing visually with
// "Most popular". The CTA links to /signup?plan=connect, which carries the
// choice through signup (INTENDED_PLAN_COOKIE, see lib/onboarding-
// options.ts) so the wizard lands straight on Connect's Square-first flow
// instead of the venue's plan step.
function PayAsYouSellStrip() {
  return (
    <Card elevation="rest" className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6">
      <div>
        <h3 className="font-display text-display-sm font-semibold">Already use Square?</h3>
        <p className="mt-1 text-sm text-muted">{PAY_AS_YOU_SELL_BLURB}</p>
      </div>
      <LinkButton href="/signup?plan=connect" variant="secondary" className="shrink-0">
        Start free with Square
      </LinkButton>
    </Card>
  );
}
