"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLapsedAction } from "@/app/admin/orgs/actions";

export function LapsedToggle({ orgId, lapsed }: { orgId: string; lapsed: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    start(async () => {
      const res = await setLapsedAction(orgId, !lapsed);
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={toggle}
        className="text-xs rounded-[var(--radius-xs)] border border-line px-2.5 py-1.5 hover:border-ink/30 disabled:opacity-50"
      >
        {pending ? "…" : lapsed ? "Clear lapse" : "Mark lapsed"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
