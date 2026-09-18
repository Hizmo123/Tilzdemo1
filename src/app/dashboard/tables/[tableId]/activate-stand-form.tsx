"use client";

import { useActionState, useRef, useEffect } from "react";
import { activateStandForTable } from "../actions";
import type { TableActionState } from "../actions";
import { Label, Input, FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

const initial: TableActionState = {};

export function ActivateStandForm({ tableId }: { tableId: string }) {
  const action = activateStandForTable.bind(null, tableId);
  const [state, formAction] = useActionState(action, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && !state.error) formRef.current?.reset();
  }, [state]);

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
      <h2 className="font-display text-lg font-semibold tracking-tight mb-1">
        Activate a stand
      </h2>
      <p className="text-sm text-muted mb-4">
        Type the serial printed on the physical stand to put it on this
        table.
      </p>
      <form ref={formRef} action={formAction} className="space-y-4">
        <div className="max-w-xs">
          <Label htmlFor="serial">Stand serial</Label>
          <Input
            id="serial"
            name="serial"
            placeholder="TZ-000123"
            required
          />
        </div>

        {state.error && <FormMessage tone="error">{state.error}</FormMessage>}

        <div className="max-w-[160px]">
          <SubmitButton pendingLabel="Activating…">Activate</SubmitButton>
        </div>
      </form>
    </div>
  );
}
