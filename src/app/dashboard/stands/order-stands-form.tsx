"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { orderStands, type StandOrderActionState } from "./actions";
import { Label, Input, FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatCents } from "@/lib/money";

const initial: StandOrderActionState = {};

type ProductRow = {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  type: "QR" | "NFC";
  priceCents: number;
};

type TableRow = {
  id: string;
  label: string;
  section: string | null;
  hasStand: boolean;
};

export function OrderStandsForm({
  products,
  tables,
}: {
  products: ProductRow[];
  tables: TableRow[];
}) {
  const [state, action] = useActionState(orderStands, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      setChecked(new Set());
      setProductId(products[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const selectedProduct = products.find((p) => p.id === productId) ?? null;
  const totalCents = selectedProduct ? selectedProduct.priceCents * checked.size : 0;

  return (
    <form ref={formRef} action={action} className="space-y-6">
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight mb-1">
          Choose a product
        </h2>
        <p className="text-sm text-muted mb-4">
          Pick which stand you&apos;d like to order.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {products.map((p) => {
            const selected = productId === p.id;
            return (
              <label
                key={p.id}
                className={`flex gap-3 rounded-[var(--radius-card)] border p-4 cursor-pointer transition-colors ${
                  selected
                    ? "border-pine bg-pine-soft/40"
                    : "border-line hover:border-ink/30"
                }`}
              >
                <input
                  type="radio"
                  name="productId"
                  value={p.id}
                  checked={selected}
                  onChange={() => setProductId(p.id)}
                  className="sr-only"
                />
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-paper border border-line shrink-0 flex items-center justify-center">
                  {p.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-muted text-center leading-tight px-1">
                      No photo
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{p.title}</span>
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-paper text-muted">
                      {p.type}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5 line-clamp-2">
                    {p.description}
                  </p>
                  <p className="text-sm font-medium mt-1">
                    {formatCents(p.priceCents)}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

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

      {selectedProduct && checked.size > 0 && (
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
          <h2 className="font-display text-lg font-semibold tracking-tight mb-3">
            Review
          </h2>
          <p className="text-sm">
            {checked.size} × {selectedProduct.title} ({formatCents(selectedProduct.priceCents)})
          </p>
          <p className="text-lg font-semibold mt-2">
            Total: {formatCents(totalCents)}
          </p>
        </div>
      )}

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
