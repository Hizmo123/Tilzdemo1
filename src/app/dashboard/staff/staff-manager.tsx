"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import {
  inviteStaff,
  revokeInvite,
  removeMember,
  changeMemberRole,
  type StaffActionState,
} from "./actions";
import { Label, Input, FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ROLE_META, ASSIGNABLE_ROLES } from "@/lib/rbac";

type Member = {
  id: string;
  email: string;
  role: Role;
  isSelf: boolean;
};
type Invite = {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
};

const initial: StaffActionState = {};

export function StaffManager({
  members,
  invites,
}: {
  members: Member[];
  invites: Invite[];
}) {
  return (
    <div className="space-y-8">
      <InviteForm />
      <Members members={members} />
      {invites.length > 0 && <PendingInvites invites={invites} />}
    </div>
  );
}

function InviteForm() {
  const [state, action] = useActionState(inviteStaff, initial);
  const ref = useRef<HTMLFormElement>(null);
  const [lastUrl, setLastUrl] = useState<string | null>(null);

  useEffect(() => {
    if (state?.inviteUrl) {
      setLastUrl(state.inviteUrl);
      ref.current?.reset();
    }
  }, [state]);

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
      <h2 className="font-display text-lg font-semibold tracking-tight mb-1">
        Invite a team member
      </h2>
      <p className="text-sm text-muted mb-4">
        They&apos;ll get a link to join. Email delivery isn&apos;t wired up yet,
        so copy the link and send it to them.
      </p>
      <form
        ref={ref}
        action={action}
        className="grid sm:grid-cols-[1fr_160px_auto] gap-3 items-end"
      >
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="chef@venue.com" required />
        </div>
        <div>
          <Label htmlFor="role">Role</Label>
          <select
            id="role"
            name="role"
            defaultValue="STAFF"
            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink focus:border-pine focus:outline-none"
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_META[r].label}
              </option>
            ))}
          </select>
        </div>
        <div className="w-[140px]">
          <SubmitButton pendingLabel="Inviting…">Invite</SubmitButton>
        </div>
      </form>

      {state?.error && (
        <div className="mt-3">
          <FormMessage tone="error">{state.error}</FormMessage>
        </div>
      )}

      {lastUrl && (
        <div className="mt-4 rounded-lg bg-pine-soft p-3">
          <p className="text-sm text-pine-deep font-medium mb-1">
            Invite created — share this link:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs break-all bg-surface rounded px-2 py-1.5">
              {lastUrl}
            </code>
            <button
              onClick={() => navigator.clipboard?.writeText(lastUrl)}
              className="text-xs rounded-md border border-line bg-surface px-2.5 py-1.5 hover:border-ink/30"
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Members({ members }: { members: Member[] }) {
  return (
    <div>
      <h3 className="font-display text-lg font-semibold tracking-tight mb-3">
        Team ({members.length})
      </h3>
      <div className="space-y-2">
        {members.map((m) => (
          <MemberRow key={m.id} member={m} />
        ))}
      </div>
    </div>
  );
}

function MemberRow({ member }: { member: Member }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  const isOwner = member.role === "OWNER";
  const locked = isOwner || member.isSelf;

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium truncate">
            {member.email}
            {member.isSelf && <span className="text-muted"> (you)</span>}
          </p>
          <p className="text-xs text-muted">{ROLE_META[member.role].blurb}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {locked ? (
            <span className="text-sm text-muted">{ROLE_META[member.role].label}</span>
          ) : (
            <select
              disabled={pending}
              value={member.role}
              onChange={(e) =>
                run(() => changeMemberRole(member.id, e.target.value as Role))
              }
              className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm focus:border-pine focus:outline-none"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_META[r].label}
                </option>
              ))}
            </select>
          )}
          {!locked && (
            <button
              disabled={pending}
              onClick={() => run(() => removeMember(member.id))}
              className="text-xs text-muted hover:text-danger disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-danger mt-2">{error}</p>}
    </div>
  );
}

function PendingInvites({ invites }: { invites: Invite[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div>
      <h3 className="font-display text-lg font-semibold tracking-tight mb-3">
        Pending invites ({invites.length})
      </h3>
      <div className="space-y-2">
        {invites.map((inv) => (
          <div
            key={inv.id}
            className="rounded-[var(--radius-card)] border border-line bg-surface p-4 flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="font-medium truncate">{inv.email}</p>
              <p className="text-xs text-muted">
                {ROLE_META[inv.role].label} · expires{" "}
                {new Date(inv.expiresAt).toLocaleDateString("en-AU")}
              </p>
            </div>
            <button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await revokeInvite(inv.id);
                  router.refresh();
                })
              }
              className="text-xs text-muted hover:text-danger disabled:opacity-50 shrink-0"
            >
              Revoke
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
