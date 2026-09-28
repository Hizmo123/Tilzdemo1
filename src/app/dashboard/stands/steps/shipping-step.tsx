"use client";

import { Label, Input } from "@/components/ui/field";
import type { ShippingValues } from "./types";

// Controlled fields with no `name` — the values are posted through hidden
// inputs at the form level (order-stands-form.tsx) so they survive this
// step collapsing when an earlier one is re-opened.
export function ShippingStep({
  value,
  onChange,
}: {
  value: ShippingValues;
  onChange: (next: ShippingValues) => void;
}) {
  const set = (key: keyof ShippingValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [key]: e.target.value });

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="sm:col-span-2">
        <Label htmlFor="shippingName">Recipient name</Label>
        <Input id="shippingName" autoComplete="name" value={value.name} onChange={set("name")} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="shippingAddress">Street address</Label>
        <Input id="shippingAddress" autoComplete="street-address" value={value.address} onChange={set("address")} />
      </div>
      <div>
        <Label htmlFor="shippingSuburb">Suburb</Label>
        <Input id="shippingSuburb" autoComplete="address-level2" value={value.suburb} onChange={set("suburb")} />
      </div>
      <div>
        <Label htmlFor="shippingState">State</Label>
        <Input id="shippingState" autoComplete="address-level1" value={value.state} onChange={set("state")} />
      </div>
      <div>
        <Label htmlFor="shippingPostcode">Postcode</Label>
        <Input id="shippingPostcode" autoComplete="postal-code" inputMode="numeric" value={value.postcode} onChange={set("postcode")} />
      </div>
    </div>
  );
}
