"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearDeletionRequestAction } from "@/app/admin/orgs/actions";

export function ClearRequestButton({ orgId, orgName }: { orgId: string; orgName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    if (!confirm(`Clear the deletion request for ${orgName}? The org keeps operating normally.`)) {
      return;
    }
    setError(null);
    start(async () => {
      const res = await clearDeletionRequestAction(orgId);
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={run}
        className="text-xs rounded-[var(--radius-xs)] border border-line px-2.5 py-1.5 hover:border-ink/30 disabled:opacity-50"
      >
        {pending ? "…" : "Clear request"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
