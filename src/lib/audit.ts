import { prisma } from "@/lib/prisma";

// Records an important action to the audit trail (spec §58). Best-effort: a
// logging failure must never break the underlying operation, so this swallows
// its own errors. Call it after the operation it describes has succeeded.
export async function audit(entry: {
  organizationId: string;
  actorUserId: string;
  actorEmail: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: entry.organizationId,
        actorUserId: entry.actorUserId,
        actorEmail: entry.actorEmail,
        action: entry.action,
        resourceType: entry.resourceType ?? null,
        resourceId: entry.resourceId ?? null,
        metadata: entry.metadata
          ? JSON.parse(JSON.stringify(entry.metadata))
          : undefined,
      },
    });
  } catch {
    // Intentionally ignored — audit logging is non-blocking.
  }
}
