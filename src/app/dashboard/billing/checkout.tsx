"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PlanTier } from "@prisma/client";
import { subscribe, cancelSubscription } from "./actions";
import { PLANS } from "@/lib/plans";
import { formatCents } from "@/lib/money";

export function Billing({
  currentPlan,
  planStatus,
  cardLast4,
}: {
  currentPlan: PlanTier;
  planStatus: string;
  cardLast4: string | null;
}) {
  const router = useRouter();
  const [checkoutTier, setCheckoutTier] = useState<PlanTier | null>(null);
  const [pending, start] = useTransition();

  const active = planStatus === "active";

  return (
    <div className="space-y-6">
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <p className="text-sm text-muted">Current plan</p>
        <p className="font-display text-2xl font-semibold tracking-tight mt-1">
          {PLANS.find((p) => p.tier === currentPlan)?.name ?? "Lite"}
          {active && currentPlan !== "LITE" && (
            <span className="text-sm font-normal text-pine-deep"> · active</span>
          )}
        </p>
        {cardLast4 && (
          <p className="text-sm text-muted mt-1">Card on file ending {cardLast4}</p>
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
        {active && currentPlan === "PRO" && (
          <Link
            href="/venues/new"
            className="text-sm text-pine hover:underline mt-3 inline-block"
          >
            + Add another venue
          </Link>
        )}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map((p) => {
          const isCurrent = p.tier === currentPlan && active;
          return (
            <div
              key={p.tier}
              className={`rounded-2xl border bg-surface p-6 flex flex-col ${
                p.tier === "GROWTH" ? "border-2 border-pine" : "border-line"
              }`}
            >
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
              <ul className="mt-5 space-y-2 text-sm text-ink-soft flex-1">
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <button
                disabled={isCurrent}
                onClick={() =>
                  p.priceCents === 0
                    ? start(async () => {
                        await subscribe("LITE", { number: "", exp: "", cvc: "" });
                        router.refresh();
                      })
                    : setCheckoutTier(p.tier)
                }
                className={`mt-6 rounded-xl py-3 font-medium ${
                  isCurrent
                    ? "bg-paper text-muted cursor-default"
                    : p.tier === "GROWTH"
                      ? "bg-pine text-white hover:bg-pine-deep"
                      : "border border-line hover:border-ink/30"
                }`}
              >
                {isCurrent ? "Current plan" : p.priceCents === 0 ? "Switch to Lite" : "Choose"}
              </button>
            </div>
          );
        })}
      </div>

      {checkoutTier && (
        <Checkout
          tier={checkoutTier}
          onClose={() => setCheckoutTier(null)}
          onDone={() => {
            setCheckoutTier(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Checkout({
  tier,
  onClose,
  onDone,
}: {
  tier: PlanTier;
  onClose: () => void;
  onDone: () => void;
}) {
  const plan = PLANS.find((p) => p.tier === tier)!;
  const [number, setNumber] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function pay() {
    setError(null);
    start(async () => {
      const res = await subscribe(tier, { number, exp, cvc });
      if (res.error) setError(res.error);
      else onDone();
    });
  }

  const field = "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 focus:border-pine focus:outline-none";

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 px-5">
      <div className="w-full max-w-sm bg-surface rounded-2xl border border-line p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Subscribe to {plan.name}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-sm">
            Close
          </button>
        </div>
        <p className="text-sm text-muted mb-4">
          {formatCents(plan.priceCents, "AUD")}
          {plan.perVenue ? " per venue" : ""} / month
        </p>

        <div className="rounded-lg bg-amber-50 text-amber-800 text-xs px-3 py-2 mb-4">
          Test mode — no real charge. Use card 4242 4242 4242 4242, any future
          expiry, any CVC.
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted block mb-1">Card number</label>
            <input
              inputMode="numeric"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="4242 4242 4242 4242"
              className={field}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted block mb-1">Expiry</label>
              <input
                value={exp}
                onChange={(e) => setExp(e.target.value)}
                placeholder="MM/YY"
                className={field}
              />
            </div>
            <div>
              <label className="text-sm text-muted block mb-1">CVC</label>
              <input
                inputMode="numeric"
                value={cvc}
                onChange={(e) => setCvc(e.target.value)}
                placeholder="123"
                className={field}
              />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-danger mt-3">{error}</p>}

        <button
          onClick={pay}
          disabled={pending}
          className="mt-5 w-full rounded-xl bg-pine text-white py-3 font-medium hover:bg-pine-deep disabled:opacity-60"
        >
          {pending ? "Processing…" : `Subscribe · ${formatCents(plan.priceCents, "AUD")}/mo · test`}
        </button>
      </div>
    </div>
  );
}
