"use client";

import { useActionState } from "react";
import {
  createRestaurant,
  type CreateRestaurantState,
} from "./actions";
import { Label, Input, FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

const initial: CreateRestaurantState = {};

export function CreateRestaurantForm() {
  const [state, action] = useActionState(createRestaurant, initial);

  return (
    <div className="max-w-md rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-rest">
      <h2 className="font-display text-xl font-semibold tracking-tight">
        Create your restaurant
      </h2>
      <p className="text-sm text-muted mt-1 mb-6">
        This is your first venue. You can add more locations later.
      </p>

      <form action={action} className="space-y-4">
        <div>
          <Label htmlFor="restaurantName">Restaurant name</Label>
          <Input
            id="restaurantName"
            name="restaurantName"
            placeholder="Harbour Kitchen"
            required
          />
        </div>
        <div>
          <Label htmlFor="locationName">First location</Label>
          <Input
            id="locationName"
            name="locationName"
            placeholder="Sydney CBD"
            required
          />
        </div>

        {state.error && <FormMessage tone="error">{state.error}</FormMessage>}

        <SubmitButton pendingLabel="Creating…">Create restaurant</SubmitButton>
      </form>
    </div>
  );
}
