import { prisma } from "@/lib/prisma";

// Everything about an organization worth handing back on a data-export
// request: its venues, floor plan, menu and staff list. Deliberately excludes
// bill/payment history — that's already available, per-venue, as a dated CSV
// from Invoices → Export, and bundling years of transactions into this same
// export would make an already-large JSON file unwieldy for what's meant to
// be a quick "here's my venue setup" download.
export async function exportOrganizationData(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      memberships: {
        select: { userId: true, role: true, createdAt: true },
      },
      restaurants: {
        include: {
          locations: {
            include: { tables: { select: { id: true, label: true, section: true, active: true } } },
          },
          menuCategories: {
            include: {
              items: {
                include: {
                  modifierGroups: { include: { options: true } },
                },
              },
            },
          },
          // Names and roles only — never the PIN hash.
          staffAccounts: {
            select: { id: true, name: true, role: true, active: true, createdAt: true },
          },
        },
      },
    },
  });
  return org;
}

// A self-service deletion REQUEST, not an instant purge — see the
// Organization.deletionRequestedAt comment in schema.prisma for why: paid
// bills are tax invoices with a 5-year statutory retention period in
// Australia, so this can't just cascade-delete everything the moment someone
// clicks a button. Recording the request (who, when) is real progress on its
// own — it's what a support-assisted final purge is triggered from — without
// pretending a full, safe, instant self-service delete already exists.
export async function requestAccountDeletion(organizationId: string, requestedByEmail: string) {
  await prisma.organization.update({
    where: { id: organizationId },
    data: { deletionRequestedAt: new Date(), deletionRequestedByEmail: requestedByEmail },
  });
}

export async function cancelAccountDeletion(organizationId: string) {
  await prisma.organization.update({
    where: { id: organizationId },
    data: { deletionRequestedAt: null, deletionRequestedByEmail: null },
  });
}

// Deactivation is no longer self-service: Organization.deactivatedAt is set
// only by a platform admin (lib/admin/account-actions.ts#adminSuspendOrg) and
// cleared by adminReactivateOrg. The login blocks in dashboard/layout.tsx and
// lib/staff-auth.ts key off deactivatedAt regardless of who set it. The
// reactivationToken columns remain on the schema (unused, nullable) —
// adminReactivateOrg already clears them defensively.
