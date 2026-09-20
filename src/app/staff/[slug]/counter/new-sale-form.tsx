"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startCounterSale } from "./actions";

type LocationRow = { id: string; name: string };

export function NewSaleForm({ slug, locations }: { slug: string; locations: LocationRow[] }) {
  const router = useRouter();
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function newSale() {
    if (!locationId) {
      setError("No location found for this venue.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await startCounterSale(slug, locationId);
      if ("error" in res) setError(res.error ?? "Something went wrong.");
      else router.push(`/staff/${slug}/counter/${res.billId}`);
    });
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 flex items-center gap-3 flex-wrap">
      {locations.length > 1 && (
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
      )}
      <button
        type="button"
        disabled={pending}
        onClick={newSale}
        className="rounded-lg bg-pine text-white px-4 py-2.5 text-sm font-medium hover:bg-pine-deep disabled:opacity-60"
      >
        {pending ? "Starting…" : "New sale"}
      </button>
      {error && <span className="text-sm text-danger">{error}</span>}
    </div>
  );
}
