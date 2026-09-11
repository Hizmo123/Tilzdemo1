import Link from "next/link";
import { getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StaffManager } from "./staff-manager";

export default async function StaffPage() {
  const authz = await getAuthz();

  if (!authz.membership) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Team
        </h1>
        <p className="text-muted">
          Create your restaurant first from the{" "}
          <Link href="/dashboard" className="text-pine hover:underline">
            Overview
          </Link>{" "}
          page.
        </p>
      </div>
    );
  }

  if (!authz.can("staff:manage")) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Team
        </h1>
        <p className="text-muted">
          You don&apos;t have permission to manage staff.
        </p>
      </div>
    );
  }

  const organizationId = authz.membership.organizationId;

  const [members, invites] = await Promise.all([
    prisma.membership.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.staffInvite.findMany({
      where: { organizationId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Team
        </h1>
        <p className="text-muted mt-1">
          Invite staff and control what each person can do.
        </p>
      </div>

      <StaffManager
        members={members.map((m) => ({
          id: m.id,
          email: m.email,
          role: m.role,
          isSelf: m.userId === authz.user.id,
        }))}
        invites={invites.map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          expiresAt: i.expiresAt.toISOString(),
        }))}
      />
    </div>
  );
}
