"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { orderStands, type StandOrderActionState } from "./actions";
import { Label, Input, FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

const initial: StandOrderActionState = {};

type TableRow = {
  id: string;
  label: string;
  section: string | null;
  hasStand: boolean;
};

export function OrderStandsForm({ tables }: { tables: TableRow[] }) {
  const [state, action] = useActionState(orderStands, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      setChecked(new Set());
    }
  }, [state]);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (tables.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-8 text-center">
        <p className="text-muted">Add a table first before ordering stands.</p>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} className="space-y-6">
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight mb-1">
          Which tables?
        </h2>
        <p className="text-sm text-muted mb-4">
          One stand is ordered per table you tick. Tables that already have an
          active stand are shown but pre-selecting them will order a spare.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {tables.map((t) => (
            <label
              key={t.id}
              className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm cursor-pointer hover:border-ink/30 transition-colors"
            >
              <input
                type="checkbox"
                name="tableIds"
                value={t.id}
                checked={checked.has(t.id)}
                onChange={() => toggle(t.id)}
              />
              <span>
                {t.label}
                {t.section ? ` · ${t.section}` : ""}
              </span>
              {t.hasStand && (
                <span className="ml-auto text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-pine-soft text-pine-deep">
                  Has stand
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight mb-4">
          Shipping address
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label htmlFor="shippingName">Recipient name</Label>
            <Input id="shippingName" name="shippingName" required />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="shippingAddress">Street address</Label>
            <Input id="shippingAddress" name="shippingAddress" required />
          </div>
          <div>
            <Label htmlFor="shippingSuburb">Suburb</Label>
            <Input id="shippingSuburb" name="shippingSuburb" required />
          </div>
          <div>
            <Label htmlFor="shippingState">State</Label>
            <Input id="shippingState" name="shippingState" required />
          </div>
          <div>
            <Label htmlFor="shippingPostcode">Postcode</Label>
            <Input id="shippingPostcode" name="shippingPostcode" required />
          </div>
        </div>
      </div>

      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.success && (
        <FormMessage tone="info">
          Order placed — we&apos;ll ship it soon.
        </FormMessage>
      )}

      <div className="max-w-xs">
        <SubmitButton pendingLabel="Placing order…">
          Order {checked.size || ""} stand{checked.size === 1 ? "" : "s"}
        </SubmitButton>
      </div>
    </form>
  );
}
