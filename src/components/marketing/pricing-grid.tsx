"use client";

import { PLANS, planPriceLabel, type PlanDef } from "@/lib/plans";
import { isTrialableTier, TRIAL_DAYS } from "@/lib/plan-subscription";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlanCardShell, PlanFeaturesReveal, usePlanExpansion } from "@/components/ui/expandable-plan-card";

// The tier we lead with. Growth is the plan a venue going live across the
// whole floor actually lands on — no table cap, no "Powered by Tillz" on
// their ordering page — so it's the one we mark "Most popular". Basic is the
// on-ramp, Pro is for groups.
const RECOMMENDED_TIER: PlanDef["tier"] = "GROWTH";

// Client component (the "Full features" expand/squeeze interaction needs
// state) rendered from the marketing homepage's server component (Pricing()
// in src/app/page.tsx), which keeps everything around it — the section
// intro, the "Prices in AUD…" footnote — server-rendered.
export function PricingGrid() {
  const { expandedTier, toggle: toggleExpanded } = usePlanExpansion();

  return (
    // Flex, not CSS grid — same responsive column counts as before
    // (1/2/3/5), but PlanCardShell's per-card flex-basis needs a flex
    // parent to grow the expanded card and squeeze its siblings narrower.
    // Same interaction, same component, as the dashboard Billing grid (see
    // components/ui/expandable-plan-card.tsx). PlanCardShell must be a
    // DIRECT flex child for its flex-basis to apply, so — unlike the rest
    // of this page — this grid doesn't route through RevealGroup/RevealItem
    // (that scroll-triggered stagger needs to own the same element).
    <div className="mt-10 flex flex-wrap gap-4 pt-3">
      {PLANS.map((plan) => (
        <PlanCardShell key={plan.tier} tier={plan.tier} expandedTier={expandedTier} className="h-full">
          <PricingCard
            plan={plan}
            expanded={expandedTier === plan.tier}
            onToggleExpand={() => toggleExpanded(plan.tier)}
          />
        </PlanCardShell>
      ))}
    </div>
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
  // Connect is free monthly but not "free" in the Lite sense — it carries a
  // per-order fee instead of a subscription, so it gets its own visual
  // treatment (an accent tint + its own badge) rather than either the
  // "Most popular" ring or Lite's quiet/muted card.
  const connect = plan.tier === "CONNECT";
  return (
    <Card
      elevation={recommended || connect ? "raised" : "rest"}
      className={`relative flex flex-col p-6 h-full ${
        recommended
          ? "ring-2 ring-pine"
          : connect
            ? "ring-1 ring-pine/40 bg-pine-tint"
            : free
              ? "bg-surface-2/60"
              : ""
      }`}
    >
      {recommended && (
        <span className="absolute -top-3 left-6 text-[11px] font-semibold uppercase tracking-wide bg-accent-gradient text-on-accent px-2.5 py-1 rounded-pill shadow-accent">
          Most popular
        </span>
      )}
      {connect && (
        <span className="absolute -top-3 left-6 text-[11px] font-semibold uppercase tracking-wide bg-surface text-pine-deep border border-pine/30 px-2.5 py-1 rounded-pill shadow-rest">
          No subscription
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
      {connect && <p className="text-xs text-pine-deep font-medium mt-1">+ ~2% per order — cancel any time</p>}
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
