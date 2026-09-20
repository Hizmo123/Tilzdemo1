"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { suspendOrgAction } from "@/app/admin/orgs/actions";

export function SuspendButton({ orgId, orgName }: { orgId: string; orgName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    if (!confirm(`Suspend ${orgName}? This blocks dashboard and staff PIN logins for the whole org until an admin reactivates it.`)) {
      return;
    }
    setError(null);
    start(async () => {
      const res = await suspendOrgAction(orgId);
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
        className="text-xs rounded-md border border-danger/40 text-danger px-2.5 py-1.5 hover:bg-danger-soft disabled:opacity-50"
      >
        {pending ? "…" : "Suspend now"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
