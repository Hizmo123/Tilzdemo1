"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PlanTier } from "@prisma/client";
import { changePlanAction } from "@/app/admin/orgs/actions";

export function ChangePlanForm({
  orgId,
  currentTier,
  tiers,
}: {
  orgId: string;
  currentTier: PlanTier;
  tiers: { tier: PlanTier; name: string }[];
}) {
  const router = useRouter();
  const [tier, setTier] = useState<PlanTier>(currentTier);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    start(async () => {
      const res = await changePlanAction(orgId, tier);
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={tier}
        onChange={(e) => setTier(e.target.value as PlanTier)}
        className="rounded-[var(--radius-md)] border border-line bg-surface px-3 py-2 text-sm focus:border-pine focus:outline-none"
      >
        {tiers.map((t) => (
          <option key={t.tier} value={t.tier}>
            {t.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending || tier === currentTier}
        onClick={save}
        className="text-xs rounded-[var(--radius-xs)] border border-line px-2.5 py-2 hover:border-ink/30 disabled:opacity-40"
      >
        {pending ? "Saving…" : "Change plan"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
