"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { publishRestaurant, unpublishRestaurant } from "@/app/dashboard/actions";

// Gates whether customers can actually reach /v/[token] or /m/[slug] (see
// lib/entitlements.ts#getPublishReadiness, dashboard/actions.ts#publishRestaurant).
// Publishing needs "ready" (subscribed, and — for Connect only — an active
// Square connection too); taking a live venue offline never needs either.
export function PublishControl({
  published,
  subscribed,
  // Connect-only: true when subscribed but Square isn't (yet, or no
  // longer) actively connected — a distinct reason from "not subscribed",
  // since Connect has no subscription to point them at instead.
  squareDisconnected = false,
}: {
  published: boolean;
  subscribed: boolean;
  squareDisconnected?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    start(async () => {
      const res = published ? await unpublishRestaurant() : await publishRestaurant();
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  const ready = subscribed && !squareDisconnected;

  if (published) {
    return (
      <div data-tour="publish" className="rounded-[var(--radius-card)] border border-line bg-surface p-5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-pill ${squareDisconnected ? "bg-danger" : "bg-pine"}`} />
            <p className="font-medium">You&apos;re live</p>
          </div>
          <button
            disabled={pending}
            onClick={toggle}
            className="text-sm text-muted hover:text-danger disabled:opacity-50"
          >
            {pending ? "…" : "Take offline"}
          </button>
        </div>
        {squareDisconnected && (
          <p className="text-sm text-danger">
            Square isn&apos;t connected right now — orders can&apos;t be paid for until you{" "}
            <Link href="/dashboard/settings/integrations" className="underline">
              reconnect it
            </Link>
            .
          </p>
        )}
      </div>
    );
  }

  return (
    <div data-tour="publish" className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Not live yet</p>
          <p className="text-sm text-muted">
            {ready
              ? "Customers can't order or view your menu until you publish."
              : squareDisconnected
                ? "Connect your Square account before you can go live — this plan runs entirely on it."
                : "Confirm a plan on Billing before you can go live — billing is mock for now, so no card is actually charged."}
          </p>
        </div>
        {ready ? (
          <button
            disabled={pending}
            onClick={toggle}
            className="rounded-[var(--radius-sm)] bg-pine text-white px-4 py-2 text-sm font-medium hover:bg-pine-deep disabled:opacity-60 shrink-0"
          >
            {pending ? "Publishing…" : "Publish / Go live"}
          </button>
        ) : (
          <Link
            href={squareDisconnected ? "/dashboard/settings/integrations" : "/dashboard/billing"}
            className="rounded-[var(--radius-sm)] bg-pine text-white px-4 py-2 text-sm font-medium hover:bg-pine-deep shrink-0"
          >
            {squareDisconnected ? "Connect Square" : "Go to Billing"}
          </Link>
        )}
      </div>
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
    </div>
  );
}
