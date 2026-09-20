"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reactivateOrgAction } from "@/app/admin/orgs/actions";

export function ReactivateButton({ orgId, orgName }: { orgId: string; orgName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    if (!confirm(`Reactivate ${orgName}? This restores dashboard and staff PIN logins for the whole org.`)) {
      return;
    }
    setError(null);
    start(async () => {
      const res = await reactivateOrgAction(orgId);
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
        className="text-xs rounded-md bg-pine text-white px-2.5 py-1.5 hover:bg-pine-deep disabled:opacity-50"
      >
        {pending ? "…" : "Reactivate"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
