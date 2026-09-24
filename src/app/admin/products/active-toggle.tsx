"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setStandProductActive } from "./actions";

export function ActiveToggle({ productId, active }: { productId: string; active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    start(async () => {
      const res = await setStandProductActive(productId, !active);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={toggle}
        className={`text-xs rounded-[var(--radius-xs)] border px-2.5 py-1.5 disabled:opacity-50 ${
          active
            ? "border-line hover:border-danger/40 hover:text-danger"
            : "border-line hover:border-pine/40 hover:text-pine-deep"
        }`}
      >
        {pending ? "…" : active ? "Retire" : "Reactivate"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
