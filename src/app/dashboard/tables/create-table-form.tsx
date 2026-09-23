"use client";

import { useActionState, useRef, useEffect } from "react";
import { createTable, type TableActionState } from "./actions";
import { Label, Input, FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

const initial: TableActionState = {};

export function CreateTableForm() {
  const [state, action] = useActionState(createTable, initial);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the fields after a successful submit (no error returned).
  useEffect(() => {
    if (state && !state.error) formRef.current?.reset();
  }, [state]);

  return (
    <div data-tour="tables-add" className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
      <h2 className="font-display text-lg font-semibold tracking-tight mb-4">
        Add a table
      </h2>
      <form ref={formRef} action={action} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="label">Table name / number</Label>
            <Input id="label" name="label" placeholder="14" required />
          </div>
          <div>
            <Label htmlFor="section">Section (optional)</Label>
            <Input id="section" name="section" placeholder="Dining Room" />
          </div>
        </div>

        {state.error && <FormMessage tone="error">{state.error}</FormMessage>}

        <div className="max-w-[200px]">
          <SubmitButton pendingLabel="Adding…">Add table</SubmitButton>
        </div>
      </form>
    </div>
  );
}
