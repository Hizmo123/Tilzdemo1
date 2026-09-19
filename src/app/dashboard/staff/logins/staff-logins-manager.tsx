"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import {
  createStaffLogin,
  resetPin,
  setStaffActive,
  changeStaffRole,
  changeStaffStation,
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
  assignedStation: string | null;
  lastLoginAt: string | null;
};

const initial: StaffLoginActionState = {};

export function StaffLoginsManager({
  staff,
  loginUrl,
  qrPreview,
  kitchenStations,
}: {
  staff: Staff[];
  loginUrl: string;
  qrPreview: string;
  kitchenStations: string[];
}) {
  return (
    <div className="space-y-8">
      <LoginLink loginUrl={loginUrl} qrPreview={qrPreview} />
      <AddStaff />
      <StaffList staff={staff} kitchenStations={kitchenStations} />
    </div>
  );
}

// This is the fix for "where do staff even sign in" and "why does the owner
// have to be involved every time": print this card once and stick it at the
// venue (till, staff room, kitchen pass). From then on, any staff member —
// current or newly added — scans it themselves to reach the sign-in page.
// The owner is only ever needed to create the PIN in the first place, never
// to hand over a link.
function LoginLink({ loginUrl, qrPreview }: { loginUrl: string; qrPreview: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
      <h2 className="font-display text-lg font-semibold tracking-tight mb-1">
        Staff sign-in page
      </h2>
      <p className="text-sm text-muted mb-4">
        Print the card below and stick it at the venue. Staff scan it, tap their
        name, and enter their PIN — no app, no email, and no need to come find
        you for the link.
      </p>
      <div className="grid sm:grid-cols-[auto_1fr] gap-5 items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrPreview}
          alt="QR code for the staff sign-in page"
          className="w-32 h-32 rounded-lg border border-line shrink-0"
          width={128}
          height={128}
        />
        <div className="space-y-3 min-w-0">
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs break-all bg-paper rounded px-2 py-1.5">
              {loginUrl}
            </code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(loginUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="text-xs shrink-0 rounded-md border border-line bg-surface px-2.5 py-1.5 hover:border-ink/30"
            >
              {copied ? "Copied ✓" : "Copy link"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={loginUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm rounded-lg border border-line bg-surface px-3.5 py-2 font-medium hover:border-ink/30 transition-colors"
            >
              Open sign-in page →
            </a>
            <a
              href="/dashboard/staff-logins/qr?format=svg"
              className="text-sm rounded-lg border border-line bg-surface px-3.5 py-2 font-medium hover:border-ink/30 transition-colors"
            >
              Download card (SVG)
            </a>
            <a
              href="/dashboard/staff-logins/qr?format=png"
              className="text-sm rounded-lg border border-line bg-surface px-3.5 py-2 font-medium hover:border-ink/30 transition-colors"
            >
              Download PNG
            </a>
          </div>
        </div>
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

function StaffList({ staff, kitchenStations }: { staff: Staff[]; kitchenStations: string[] }) {
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
            <StaffRow key={s.id} staff={s} kitchenStations={kitchenStations} />
          ))}
        </div>
      )}
    </div>
  );
}

function StaffRow({ staff, kitchenStations }: { staff: Staff; kitchenStations: string[] }) {
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
          <p className="text-xs text-muted">
            {ROLE_META[staff.role].blurb}
            {staff.role === "KITCHEN" && staff.assignedStation && (
              <> · locked to {staff.assignedStation}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {staff.role === "KITCHEN" && (
            <select
              disabled={pending}
              value={staff.assignedStation ?? ""}
              onChange={(e) => run(() => changeStaffStation(staff.id, e.target.value || null))}
              className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm focus:border-pine focus:outline-none"
              aria-label="Assigned station"
            >
              <option value="">All stations</option>
              {kitchenStations.map((s) => (
                <option key={s} value={s}>
                  {s} only
                </option>
              ))}
            </select>
          )}
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
