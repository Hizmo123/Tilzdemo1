"use client";

import { PLANS, planPriceLabel, PAY_AS_YOU_SELL_BLURB, type PlanDef } from "@/lib/plans";
import { isTrialableTier, TRIAL_DAYS } from "@/lib/plan-subscription";
import { BRAND } from "@/lib/brand";
import { LinkButton } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-classes";
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
export function PricingGrid({ paidPlansOpen = true }: { paidPlansOpen?: boolean }) {
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
              paidPlansOpen={paidPlansOpen}
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
  paidPlansOpen,
}: {
  plan: PlanDef;
  expanded: boolean;
  onToggleExpand: () => void;
  paidPlansOpen: boolean;
}) {
  const recommended = plan.tier === RECOMMENDED_TIER;
  return (
    <Card
      elevation={recommended ? "raised" : "rest"}
      className={`relative flex flex-col p-6 h-full ${recommended ? "ring-2 ring-pine" : ""}`}
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
          <span className="text-base text-muted font-normal font-sans tracking-normal"> /month inc. GST</span>
        )}
      </p>
      {paidPlansOpen && isTrialableTier(plan.tier) && (
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
      <div className="mt-7 space-y-1.5">
        {paidPlansOpen ? (
          <LinkButton href="/signup" variant={recommended ? "primary" : "secondary"} full>
            {`Choose ${plan.name}`}
          </LinkButton>
        ) : (
          <>
            <button type="button" disabled className={buttonClasses("secondary", "md", true, "opacity-60 cursor-not-allowed")}>
              Opening soon
            </button>
            <a
              href={`mailto:${BRAND.supportEmail}`}
              className="block text-center text-xs text-pine hover:underline"
            >
              Email us for early access
            </a>
          </>
        )}
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
