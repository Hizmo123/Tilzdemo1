"use client";

import { useState, useTransition } from "react";
import { confirmReactivation } from "./actions";

export function ReactivateButton({
  token,
  organizationName,
}: {
  token: string;
  organizationName: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit() {
    setError(null);
    start(async () => {
      const res = await confirmReactivation(token);
      if ("error" in res) setError(res.error);
      else setDone(true);
    });
  }

  if (done) {
    return (
      <>
        <div className="w-14 h-14 rounded-full bg-pine-soft text-pine-deep flex items-center justify-center mx-auto mb-4 text-2xl">
          ✓
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {organizationName} reactivated
        </h1>
        <p className="text-muted text-sm mt-2">
          Your account and every staff login are active again.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Reactivate {organizationName}?
      </h1>
      <p className="text-muted text-sm mt-2">
        This restores dashboard and staff PIN access for your whole team.
      </p>
      <button
        disabled={pending}
        onClick={submit}
        className="mt-5 w-full rounded-xl bg-pine text-white py-3 font-medium hover:bg-pine-deep disabled:opacity-50"
      >
        {pending ? "Reactivating…" : "Reactivate account"}
      </button>
      {error && <p className="text-sm text-danger mt-3">{error}</p>}
    </>
  );
}
