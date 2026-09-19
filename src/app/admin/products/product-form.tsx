"use client";

import { useActionState, useRef, useEffect } from "react";
import { Label, Input, FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ProductActionState } from "./actions";

const initial: ProductActionState = {};

type Defaults = {
  title: string;
  description: string;
  type: "QR" | "NFC";
  priceDollars: string;
  sortOrder: number;
};

export function ProductForm({
  action,
  defaults,
  submitLabel,
  resetOnSuccess = false,
}: {
  action: (prev: ProductActionState, formData: FormData) => Promise<ProductActionState>;
  defaults: Defaults;
  submitLabel: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state && !state.error) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            defaultValue={defaults.title}
            placeholder="Standard QR stand"
            required
          />
        </div>
        <div>
          <Label htmlFor="type">Type</Label>
          <select
            id="type"
            name="type"
            defaultValue={defaults.type}
            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink focus:border-pine focus:outline-none transition-colors"
          >
            <option value="QR">QR</option>
            <option value="NFC">NFC</option>
          </select>
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          defaultValue={defaults.description}
          rows={2}
          placeholder="What the venue is buying"
          required
          className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-muted/70 focus:border-pine focus:outline-none transition-colors resize-none"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="priceDollars">Price (AUD)</Label>
          <Input
            id="priceDollars"
            name="priceDollars"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue={defaults.priceDollars}
            placeholder="29.00"
            required
          />
        </div>
        <div>
          <Label htmlFor="sortOrder">Sort order</Label>
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            step="1"
            defaultValue={defaults.sortOrder}
          />
        </div>
      </div>

      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}

      <div className="max-w-[160px]">
        <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
