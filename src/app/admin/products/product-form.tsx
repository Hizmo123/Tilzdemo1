"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Label, Input, FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ProductActionState } from "./actions";

const initial: ProductActionState = {};

// Same fixed list actions.ts validates against — a checkbox per format, not
// a generic mime picker.
const DESIGN_FORMATS: { value: string; label: string }[] = [
  { value: "image/png", label: "PNG" },
  { value: "image/jpeg", label: "JPEG" },
  { value: "application/pdf", label: "PDF" },
  { value: "image/svg+xml", label: "SVG" },
];

type Defaults = {
  title: string;
  description: string;
  type: "QR" | "NFC";
  priceDollars: string;
  sortOrder: number;
  allowsCustomDesign: boolean;
  requiresCustomDesign: boolean;
  designGuidelines: string;
  maxDesignSizeMb: number;
  acceptedDesignMimeTypes: string[];
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
  const [allowsDesign, setAllowsDesign] = useState(defaults.allowsCustomDesign);

  useEffect(() => {
    if (resetOnSuccess && state && !state.error) {
      formRef.current?.reset();
      setAllowsDesign(defaults.allowsCustomDesign);
    }
  }, [state, resetOnSuccess, defaults.allowsCustomDesign]);

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
            className="w-full rounded-[var(--radius-md)] border border-line bg-surface px-3.5 py-2.5 text-ink focus:border-pine focus:outline-none transition-colors"
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
          className="w-full rounded-[var(--radius-md)] border border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-muted/70 focus:border-pine focus:outline-none transition-colors resize-none"
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

      <div className="rounded-[var(--radius-card)] border border-line bg-paper p-4 space-y-3">
        <label className="flex items-center gap-2.5 text-sm font-medium cursor-pointer">
          <input
            type="checkbox"
            name="allowsCustomDesign"
            checked={allowsDesign}
            onChange={(e) => setAllowsDesign(e.target.checked)}
            className="w-4 h-4 accent-pine"
          />
          Allow custom design upload
        </label>

        {allowsDesign && (
          <div className="pl-6 space-y-3 border-l-2 border-line ml-1.5">
            <label className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                name="requiresCustomDesign"
                defaultChecked={defaults.requiresCustomDesign}
                className="w-4 h-4 accent-pine"
              />
              Require a design before checkout
            </label>

            <div>
              <Label htmlFor="designGuidelines">Design guidelines</Label>
              <textarea
                id="designGuidelines"
                name="designGuidelines"
                defaultValue={defaults.designGuidelines}
                rows={3}
                placeholder="Accepted formats, dimensions, bleed/DPI notes shown to the venue above the upload field"
                className="w-full rounded-[var(--radius-md)] border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:border-pine focus:outline-none transition-colors resize-none"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="maxDesignSizeMb">Max file size (MB)</Label>
                <Input
                  id="maxDesignSizeMb"
                  name="maxDesignSizeMb"
                  type="number"
                  step="1"
                  min="1"
                  max="50"
                  defaultValue={defaults.maxDesignSizeMb}
                />
              </div>
              <div>
                <Label>Accepted formats</Label>
                <div className="flex flex-wrap gap-3 pt-2.5">
                  {DESIGN_FORMATS.map((f) => (
                    <label key={f.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        name="acceptedDesignMimeTypes"
                        value={f.value}
                        defaultChecked={defaults.acceptedDesignMimeTypes.includes(f.value)}
                        className="w-4 h-4 accent-pine"
                      />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}

      <div className="max-w-[160px]">
        <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
