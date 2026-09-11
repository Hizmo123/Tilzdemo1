import Link from "next/link";
import { getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Turns an action key + metadata into a readable line.
function describe(action: string, metadata: unknown): string {
  const m = (metadata ?? {}) as Record<string, unknown>;
  switch (action) {
    case "restaurant.created":
      return `Created restaurant ${m.name ? `"${m.name}"` : ""}`;
    case "menu.category.created":
      return `Added menu category "${m.name}"`;
    case "menu.item.created":
      return `Added menu item "${m.name}"`;
    case "menu.item.deleted":
      return `Deleted menu item "${m.name}"`;
    case "menu.item.availability":
      return `Marked "${m.name}" ${m.available ? "available" : "sold out"}`;
    case "table.created":
      return `Created table ${m.label}`;
    case "table.qr.regenerated":
      return `Regenerated QR for table ${m.label}`;
    case "table.availability":
      return `${m.active ? "Reactivated" : "Deactivated"} table ${m.label}`;
    case "staff.invited":
      return `Invited ${m.email} as ${m.role}`;
    case "staff.invite.revoked":
      return `Revoked invite for ${m.email}`;
    case "staff.member.removed":
      return `Removed ${m.email}`;
    case "staff.member.role_changed":
      return `Changed ${m.email} from ${m.from} to ${m.to}`;
    case "staff.member.joined":
      return `Joined as ${m.role}`;
    default:
      return action;
  }
}

export default async function ActivityPage() {
  const authz = await getAuthz();

  if (!authz.membership) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Activity
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

  if (!authz.can("audit:view")) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Activity
        </h1>
        <p className="text-muted">
          You don&apos;t have permission to view the activity log.
        </p>
      </div>
    );
  }

  const logs = await prisma.auditLog.findMany({
    where: { organizationId: authz.membership.organizationId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Activity
        </h1>
        <p className="text-muted mt-1">
          Recent important actions. The 100 most recent are shown.
        </p>
      </div>

      {logs.length === 0 ? (
        <p className="text-sm text-muted">No activity recorded yet.</p>
      ) : (
        <div className="rounded-[var(--radius-card)] border border-line bg-surface divide-y divide-line">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="text-sm">{describe(log.action, log.metadata)}</p>
                <p className="text-xs text-muted mt-0.5">{log.actorEmail}</p>
              </div>
              <p className="text-xs text-muted shrink-0 tabular-nums">
                {new Date(log.createdAt).toLocaleString("en-AU")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
