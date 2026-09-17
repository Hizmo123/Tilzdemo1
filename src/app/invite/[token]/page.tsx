import Link from "next/link";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_META } from "@/lib/rbac";
import { AcceptInvite } from "./accept-invite";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-paper flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center">
        {children}
      </div>
    </main>
  );
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await prisma.staffInvite.findUnique({
    where: { token },
    include: { organization: true },
  });

  if (!invite) {
    return (
      <Shell>
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Invite not found
        </h1>
        <p className="text-sm text-muted mt-2">
          This link isn&apos;t valid. Ask whoever invited you for a new one.
        </p>
      </Shell>
    );
  }

  const invalidReason =
    invite.status === "REVOKED"
      ? "This invite has been revoked."
      : invite.status === "ACCEPTED"
        ? "This invite has already been used."
        : invite.expiresAt < new Date()
          ? "This invite has expired."
          : null;

  if (invalidReason) {
    return (
      <Shell>
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Invite unavailable
        </h1>
        <p className="text-sm text-muted mt-2">{invalidReason}</p>
      </Shell>
    );
  }

  const user = await getUser();
  const roleLabel = ROLE_META[invite.role].label;

  return (
    <Shell>
      <p className="text-sm font-medium text-pine">You&apos;re invited</p>
      <h1 className="font-display text-2xl font-semibold tracking-tight mt-1">
        {invite.organization.name}
      </h1>
      <p className="text-muted mt-2">
        Join as <span className="font-medium text-ink">{roleLabel}</span> —{" "}
        {ROLE_META[invite.role].blurb}
      </p>

      {user ? (
        user.email?.toLowerCase() === invite.email.toLowerCase() ? (
          <div className="mt-6">
            <AcceptInvite token={token} />
            <p className="text-xs text-muted mt-3">Signed in as {user.email}</p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-danger">
              This invite was sent to <span className="font-medium">{invite.email}</span>, but
              you&apos;re signed in as {user.email}.
            </p>
            <p className="text-sm text-muted">
              Sign out and log in (or create an account) with {invite.email} to accept it.
            </p>
            <Link
              href="/login"
              className="inline-block rounded-lg border border-line px-4 py-2 text-sm font-medium hover:border-ink/30"
            >
              Go to login
            </Link>
          </div>
        )
      ) : (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-muted">
            Log in or create an account with{" "}
            <span className="font-medium text-ink">{invite.email}</span>, then
            open this link again to accept.
          </p>
          <div className="flex gap-2 justify-center">
            <Link
              href="/login"
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:border-ink/30"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-pine text-white px-4 py-2 text-sm font-medium hover:bg-pine-deep"
            >
              Sign up
            </Link>
          </div>
        </div>
      )}
    </Shell>
  );
}
