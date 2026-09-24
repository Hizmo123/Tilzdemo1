"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { suspendOrgAction } from "@/app/admin/orgs/actions";

// Suspend blocks every login (dashboard + every staff PIN) in the org until
// an admin reactivates it — the most consequential action on this screen, so
// unlike Reactivate/Clear request (a plain confirm() is enough there) this
// requires typing the org's exact name before the button enables, the same
// bar a destructive action usually clears elsewhere in this app.
export function SuspendButton({ orgId, orgName }: { orgId: string; orgName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    start(async () => {
      const res = await suspendOrgAction(orgId);
      if ("error" in res) setError(res.error);
      else {
        setOpen(false);
        setTyped("");
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs rounded-[var(--radius-xs)] border border-danger/40 text-danger px-2.5 py-1.5 hover:bg-danger-soft"
      >
        Suspend now
      </button>
    );
  }

  const matches = typed.trim() === orgName;

  return (
    <div className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger-soft/40 p-3 space-y-2 max-w-xs">
      <p className="text-xs text-ink">
        This blocks dashboard and staff PIN logins for the whole org. Type{" "}
        <span className="font-semibold">{orgName}</span> to confirm.
      </p>
      <input
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={orgName}
        className="w-full rounded-[var(--radius-xs)] border border-line bg-surface px-2.5 py-1.5 text-sm focus:border-danger focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!matches || pending}
          onClick={run}
          className="text-xs rounded-[var(--radius-xs)] bg-danger text-white px-2.5 py-1.5 disabled:opacity-40"
        >
          {pending ? "…" : "Suspend"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setTyped("");
            setError(null);
          }}
          className="text-xs text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
