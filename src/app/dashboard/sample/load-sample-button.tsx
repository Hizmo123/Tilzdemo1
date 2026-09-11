"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loadSampleData } from "./actions";

export function LoadSampleButton({
  variant = "card",
}: {
  variant?: "card" | "inline";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    setMsg(null);
    start(async () => {
      const res = await loadSampleData();
      if (res.error) setError(res.error);
      else {
        const parts = [];
        if (res.addedMenu) parts.push("sample menu");
        if (res.addedTables) parts.push("12 tables with QR codes");
        setMsg(`Added ${parts.join(" and ")}. Take a look around!`);
        router.refresh();
      }
    });
  }

  const button = (
    <button
      onClick={run}
      disabled={pending}
      className="rounded-lg bg-pine text-white px-4 py-2 text-sm font-medium hover:bg-pine-deep disabled:opacity-60"
    >
      {pending ? "Loading…" : "Load a sample café"}
    </button>
  );

  if (variant === "inline") {
    return (
      <div>
        {button}
        {msg && <p className="text-sm text-pine-deep mt-2">{msg}</p>}
        {error && <p className="text-sm text-danger mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-6">
      <h2 className="font-display text-lg font-semibold tracking-tight mb-1">
        New here?
      </h2>
      <p className="text-sm text-muted mb-4">
        Load a sample café menu and a set of tables to see everything working.
        You can edit or clear it anytime.
      </p>
      {button}
      {msg && <p className="text-sm text-pine-deep mt-3">{msg}</p>}
      {error && <p className="text-sm text-danger mt-3">{error}</p>}
    </div>
  );
}
