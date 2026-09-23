"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { publishRestaurant, unpublishRestaurant } from "@/app/dashboard/actions";

// Gates whether customers can actually reach /v/[token] or /m/[slug] (see
// lib/entitlements.ts#isOrgSubscribed, dashboard/actions.ts#publishRestaurant).
// Publishing needs an active (mock) plan; taking a live venue offline never
// needs one.
export function PublishControl({
  published,
  subscribed,
}: {
  published: boolean;
  subscribed: boolean;
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

  if (published) {
    return (
      <div data-tour="publish" className="rounded-[var(--radius-card)] border border-line bg-surface p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-pine" />
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
    );
  }

  return (
    <div data-tour="publish" className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Not live yet</p>
          <p className="text-sm text-muted">
            {subscribed
              ? "Customers can't order or view your menu until you publish."
              : "Confirm a plan on Billing before you can go live — billing is mock for now, so no card is actually charged."}
          </p>
        </div>
        {subscribed ? (
          <button
            disabled={pending}
            onClick={toggle}
            className="rounded-lg bg-pine text-white px-4 py-2 text-sm font-medium hover:bg-pine-deep disabled:opacity-60 shrink-0"
          >
            {pending ? "Publishing…" : "Publish / Go live"}
          </button>
        ) : (
          <Link
            href="/dashboard/billing"
            className="rounded-lg bg-pine text-white px-4 py-2 text-sm font-medium hover:bg-pine-deep shrink-0"
          >
            Go to Billing
          </Link>
        )}
      </div>
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
    </div>
  );
}
