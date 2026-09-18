"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { orderStands } from "./actions";
import { formatCents } from "@/lib/money";

type Table = { id: string; label: string; section: string | null };

export function OrderStandsForm({
  tables,
  currency,
  unitPriceCents,
}: {
  tables: Table[];
  currency: string;
  unitPriceCents: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [suburb, setSuburb] = useState("");
  const [state, setState] = useState("");
  const [postcode, setPostcode] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((s) => (s.size === tables.length ? new Set() : new Set(tables.map((t) => t.id))));
  }

  const quantity = selected.size;
  const totalCents = quantity * unitPriceCents;

  function submit() {
    setError(null);
    if (selected.size === 0) {
      setError("Select at least one table.");
      return;
    }
    if (!line1.trim() || !suburb.trim() || !state.trim() || !postcode.trim()) {
      setError("Fill in the full shipping address.");
      return;
    }
    start(async () => {
      const res = await orderStands({
        tableIds: [...selected],
        shippingAddress: { line1, line2, suburb, state, postcode },
      });
      if (res.error) setError(res.error);
      else {
        setDone(true);
        router.refresh();
      }
    });
  }

  if (done) {
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-pine-soft text-pine-deep flex items-center justify-center mx-auto mb-4 text-2xl">
          ✓
        </div>
        <h2 className="font-display text-lg font-semibold tracking-tight">Order placed</h2>
        <p className="text-sm text-muted mt-1.5">
          {quantity} stand{quantity === 1 ? "" : "s"} — we&apos;ll print and ship them shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold tracking-tight">Tables</h2>
          <button onClick={toggleAll} className="text-xs text-pine hover:underline">
            {selected.size === tables.length ? "Deselect all" : "Select all"}
          </button>
        </div>
        {tables.length === 0 ? (
          <p className="text-sm text-muted">No active tables to order stands for.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {tables.map((t) => (
              <label
                key={t.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                  selected.has(t.id) ? "border-pine bg-pine-soft" : "border-line hover:border-ink/20"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(t.id)}
                  onChange={() => toggle(t.id)}
                  className="accent-pine"
                />
                Table {t.label}
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">Shipping address</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
            placeholder="Street address"
            className="sm:col-span-2 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-pine focus:outline-none"
          />
          <input
            value={line2}
            onChange={(e) => setLine2(e.target.value)}
            placeholder="Unit / suite (optional)"
            className="sm:col-span-2 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-pine focus:outline-none"
          />
          <input
            value={suburb}
            onChange={(e) => setSuburb(e.target.value)}
            placeholder="Suburb"
            className="rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-pine focus:outline-none"
          />
          <input
            value={state}
            onChange={(e) => setState(e.target.value)}
            placeholder="State"
            className="rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-pine focus:outline-none"
          />
          <input
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            placeholder="Postcode"
            className="rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-pine focus:outline-none"
          />
        </div>
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">
            {quantity} stand{quantity === 1 ? "" : "s"} × {formatCents(unitPriceCents, currency)}
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">
            {formatCents(totalCents, currency)}
          </span>
        </div>
        <p className="text-xs text-muted">Test payment — no real money moves.</p>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          onClick={submit}
          disabled={pending || quantity === 0}
          className="w-full rounded-xl bg-pine text-[color:var(--on-accent,#fff)] py-3 font-medium hover:bg-pine-deep disabled:opacity-60"
        >
          {pending ? "Processing…" : `Pay ${formatCents(totalCents, currency)}`}
        </button>
      </section>
    </div>
  );
}
