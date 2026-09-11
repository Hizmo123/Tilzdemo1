"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import {
  createStaffLogin,
  resetPin,
  setStaffActive,
  changeStaffRole,
  deleteStaffLogin,
  type StaffLoginActionState,
} from "./actions";
import { Label, Input, FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ROLE_META, STAFF_PIN_ROLES } from "@/lib/rbac";

type Staff = {
  id: string;
  name: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
};

const initial: StaffLoginActionState = {};

export function StaffLoginsManager({
  staff,
  loginUrl,
}: {
  staff: Staff[];
  loginUrl: string;
}) {
  return (
    <div className="space-y-8">
      <LoginLink loginUrl={loginUrl} />
      <AddStaff />
      <StaffList staff={staff} />
    </div>
  );
}

function LoginLink({ loginUrl }: { loginUrl: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
      <h2 className="font-display text-lg font-semibold tracking-tight mb-1">
        Staff login page
      </h2>
      <p className="text-sm text-muted mb-3">
        Bookmark this on your venue&apos;s tablet or POS. Staff pick their name
        and enter their PIN — no email needed.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs break-all bg-paper rounded px-2 py-1.5">
          {loginUrl}
        </code>
        <button
          onClick={() => navigator.clipboard?.writeText(loginUrl)}
          className="text-xs rounded-md border border-line bg-surface px-2.5 py-1.5 hover:border-ink/30"
        >
          Copy
        </button>
      </div>
    </div>
  );
}

// Shows a freshly generated PIN once, prominently, for the owner to hand over.
function PinReveal({ name, pin }: { name: string; pin: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-pine/40 bg-pine-soft p-5 text-center">
      <p className="text-sm text-pine-deep">
        PIN for <span className="font-semibold">{name}</span> — write it down now,
        it won&apos;t be shown again:
      </p>
      <p className="font-display text-4xl font-semibold tracking-[0.2em] text-pine-deep mt-2 tabular-nums">
        {pin}
      </p>
    </div>
  );
}

function AddStaff() {
  const [state, action] = useActionState(createStaffLogin, initial);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.createdPin) ref.current?.reset();
  }, [state]);

  return (
    <div className="space-y-4">
      {state?.createdPin && state.createdName && (
        <PinReveal name={state.createdName} pin={state.createdPin} />
      )}
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight mb-4">
          Add an employee
        </h2>
        <form
          ref={ref}
          action={action}
          className="grid sm:grid-cols-[1fr_160px_auto] gap-3 items-end"
        >
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="Alex" required />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              name="role"
              defaultValue="STAFF"
              className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink focus:border-pine focus:outline-none"
            >
              {STAFF_PIN_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_META[r].label}
                </option>
              ))}
            </select>
          </div>
          <div className="w-[150px]">
            <SubmitButton pendingLabel="Adding…">Add & get PIN</SubmitButton>
          </div>
        </form>
        {state?.error && (
          <div className="mt-3">
            <FormMessage tone="error">{state.error}</FormMessage>
          </div>
        )}
      </div>
    </div>
  );
}

function StaffList({ staff }: { staff: Staff[] }) {
  return (
    <div>
      <h3 className="font-display text-lg font-semibold tracking-tight mb-3">
        Employees ({staff.length})
      </h3>
      {staff.length === 0 ? (
        <p className="text-sm text-muted">
          No staff logins yet. Add your first employee above.
        </p>
      ) : (
        <div className="space-y-2">
          {staff.map((s) => (
            <StaffRow key={s.id} staff={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function StaffRow({ staff }: { staff: Staff }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);

  function run(fn: () => Promise<StaffLoginActionState | { ok?: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) setError(res.error);
      else {
        if (res && "createdPin" in res && res.createdPin) setPin(res.createdPin);
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium truncate">
            {staff.name}
            {!staff.active && <span className="text-muted"> · disabled</span>}
          </p>
          <p className="text-xs text-muted">{ROLE_META[staff.role].blurb}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            disabled={pending}
            value={staff.role}
            onChange={(e) => run(() => changeStaffRole(staff.id, e.target.value as Role))}
            className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm focus:border-pine focus:outline-none"
          >
            {STAFF_PIN_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_META[r].label}
              </option>
            ))}
          </select>
          <button
            disabled={pending}
            onClick={() => run(() => resetPin(staff.id))}
            className="text-xs rounded-md border border-line px-2.5 py-1.5 hover:border-ink/30 disabled:opacity-50"
          >
            Reset PIN
          </button>
          <button
            disabled={pending}
            onClick={() => run(() => setStaffActive(staff.id, !staff.active))}
            className="text-xs rounded-md border border-line px-2.5 py-1.5 hover:border-ink/30 disabled:opacity-50"
          >
            {staff.active ? "Disable" : "Enable"}
          </button>
          <button
            disabled={pending}
            onClick={() => run(() => deleteStaffLogin(staff.id))}
            className="text-xs text-muted hover:text-danger disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
      {pin && (
        <div className="mt-3">
          <PinReveal name={staff.name} pin={pin} />
        </div>
      )}
      {error && <p className="text-xs text-danger mt-2">{error}</p>}
    </div>
  );
}
