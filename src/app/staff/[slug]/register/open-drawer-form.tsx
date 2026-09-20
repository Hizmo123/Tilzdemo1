"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { openDrawer } from "./actions";

type LocationRow = { id: string; name: string };

export function OpenDrawerForm({ slug, locations }: { slug: string; locations: LocationRow[] }) {
  const router = useRouter();
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [floatDollars, setFloatDollars] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function open() {
    const cents = Math.round(Number(floatDollars) * 100);
    if (!locationId) {
      setError("No location found for this venue.");
      return;
    }
    if (!Number.isFinite(cents) || cents < 0) {
      setError("Enter a valid opening float.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await openDrawer(slug, locationId, cents);
      if ("error" in res) setError(res.error ?? "Something went wrong.");
      else router.refresh();
    });
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 space-y-4">
      <h2 className="font-display text-lg font-semibold tracking-tight">Open the drawer</h2>
      {locations.length > 1 && (
        <div>
          <label className="text-sm text-muted mb-1 block">Location</label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-pine focus:outline-none"
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="text-sm text-muted mb-1 block">Opening float</label>
        <div className="relative max-w-[160px]">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">$</span>
          <input
            inputMode="decimal"
            value={floatDollars}
            onChange={(e) => setFloatDollars(e.target.value)}
            placeholder="200.00"
            className="w-full rounded-lg border border-line bg-surface pl-7 pr-3.5 py-2.5 text-sm focus:border-pine focus:outline-none"
          />
        </div>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={open}
        className="rounded-lg bg-pine text-white px-4 py-2.5 text-sm font-medium hover:bg-pine-deep disabled:opacity-60"
      >
        {pending ? "Opening…" : "Open drawer"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
