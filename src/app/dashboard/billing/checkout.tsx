"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PlanTier } from "@prisma/client";
import { subscribe, cancelSubscription } from "./actions";
import { PLANS } from "@/lib/plans";
import { formatCents } from "@/lib/money";

export function Billing({
  currentPlan,
  planStatus,
  squareConnected,
}: {
  currentPlan: PlanTier;
  planStatus: string;
  // Active (non-revoked) SquareConnection for this venue — same bar the
  // marketing/onboarding "Connect Square" flow uses. Determines whether
  // CONNECT's button can subscribe immediately or has to detour through
  // Settings → Integrations first (see api/square/callback/route.ts's
  // connectPlanIntent, which completes the switch once that succeeds).
  squareConnected: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

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
        {active && currentPlan === "PRO" && (
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
          one row only once there's genuinely room for it. */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4">
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
            <div
              key={p.tier}
              className={`relative rounded-2xl border bg-surface p-6 flex flex-col ${
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
