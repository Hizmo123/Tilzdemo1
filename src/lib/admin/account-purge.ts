// Hard-deletes a self-deleted organisation's RETAINED financial records once
// the statutory retention window has passed. Irreversible.
//
// SAFE TO USE ONLY after the caller has run requirePlatformAdmin() in the
// current request — nothing here checks that itself (same trust model as
// lib/admin/account-actions.ts). The "use server" entry point is
// app/admin/deletions/actions.ts, which also enforces the typed "DELETE".
//
// Deliberately NOT a scheduled job: this destroys tax records, so a person
// looks at the list (/admin/deletions) and presses the button.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";
import { deleteOrganizationFiles, type StorageLike } from "@/lib/account-storage";

export type PurgeCounts = {
  refunds: number;
  payments: number;
  billItems: number;
  orders: number;
  bills: number;
  standOrderItems: number;
  tillzStands: number;
  standOrders: number;
  tables: number;
  menuCategories: number;
  staffAccounts: number;
  memberships: number;
  restaurants: number;
};

export type PurgeResult = { ok: true; counts: PurgeCounts } | { error: string };

type EligibilityInput = {
  planStatus: string;
  deletionExecutedAt: Date | null;
  deletionPurgeEligibleAt: Date | null;
};

// The gate, as a pure function so the rule is testable on its own and the
// admin page uses the exact same check as the server action. Fails CLOSED:
// missing dates mean "not eligible", never "eligible".
export function purgeEligibility(org: EligibilityInput, now: Date = new Date()): { ok: true } | { error: string } {
  if (org.planStatus !== "deleted" || !org.deletionExecutedAt) {
    return { error: "This organisation wasn't deleted by its owner, so it can't be purged." };
  }
  if (!org.deletionPurgeEligibleAt) {
    return { error: "This organisation has no retention end date recorded, so it can't be purged." };
  }
  if (now.getTime() < org.deletionPurgeEligibleAt.getTime()) {
    const on = org.deletionPurgeEligibleAt.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
    return { error: `Records must be retained until ${on}.` };
  }
  return { ok: true };
}

// What an org still holds after self-deletion — shown on the admin page so
// the person pressing "Purge" can see what is about to disappear.
export async function getRetainedCounts(organizationId: string) {
  const restaurantIds = await restaurantIdsOf(organizationId);
  const billWhere = billScope(restaurantIds);
  const [bills, payments, refunds, orders, standOrders] = await Promise.all([
    prisma.bill.count({ where: billWhere }),
    prisma.payment.count({ where: { bill: billWhere } }),
    prisma.refund.count({ where: { payment: { bill: billWhere } } }),
    prisma.order.count({ where: orderScope(restaurantIds, billWhere) }),
    prisma.standOrder.count({ where: { organizationId } }),
  ]);
  return { bills, payments, refunds, orders, standOrders };
}

async function restaurantIdsOf(organizationId: string): Promise<string[]> {
  const rows = await prisma.restaurant.findMany({ where: { organizationId }, select: { id: true } });
  return rows.map((r) => r.id);
}

// Older bills can have a null restaurantId (the column landed after existing
// rows — see the Bill.restaurantId schema comment) and are only reachable
// through their table's location, so both routes are needed or a legacy bill
// would be left behind and block the Restaurant delete on its Payment.
function billScope(restaurantIds: string[]): Prisma.BillWhereInput {
  return {
    OR: [
      { restaurantId: { in: restaurantIds } },
      { table: { location: { restaurantId: { in: restaurantIds } } } },
    ],
  };
}

function orderScope(restaurantIds: string[], billWhere: Prisma.BillWhereInput): Prisma.OrderWhereInput {
  return { OR: [{ restaurantId: { in: restaurantIds } }, { bill: billWhere }] };
}

export async function purgeDeletedOrganization(
  organizationId: string,
  adminUserId: string,
  // Injectable so tests never touch real storage.
  deps: { storage?: StorageLike; now?: Date } = {},
): Promise<PurgeResult> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, planStatus: true, deletionExecutedAt: true, deletionPurgeEligibleAt: true },
  });
  if (!org) return { error: "Organisation not found." };

  const eligible = purgeEligibility(org, deps.now);
  if ("error" in eligible) return eligible;

  const restaurantIds = await restaurantIdsOf(organizationId);

  // Files first, and abort if it fails. Once the Organization row is gone
  // nothing references these prefixes any more, so this is the last chance to
  // remove them — better to refuse the purge than orphan someone's uploads.
  // (Deletion already swept them; this is the idempotent safety net.)
  const files = await deleteOrganizationFiles(organizationId, restaurantIds, deps.storage);
  if (files.failures.length > 0) {
    log.error("account.purge_blocked_storage", {
      organizationId,
      adminUserId,
      failures: files.failures.join(" | ").slice(0, 1000),
    });
    return { error: `Couldn't clear this organisation's stored files, so nothing was deleted: ${files.failures[0]}` };
  }

  const retained = await getRetainedCounts(organizationId);
  // Logged BEFORE anything is deleted, with ids only — log.ts forbids emails,
  // and the Organization row (and its AuditLog) is about to stop existing, so
  // this line is the durable record of who purged what and when.
  log.info("account.purge_started", { organizationId, adminUserId, restaurants: restaurantIds.length, ...retained });

  const billWhere = billScope(restaurantIds);

  try {
    const counts = await prisma.$transaction(
      async (tx) => {
        // FK-safe order, children first. Payment -> Bill and Refund ->
        // Payment are onDelete: Restrict, so they MUST go explicitly before
        // the Bills they hang off; everything else would cascade, but is
        // deleted explicitly too so the counts are real and the order is
        // obvious rather than implied.
        const refunds = await tx.refund.deleteMany({ where: { payment: { bill: billWhere } } });
        const payments = await tx.payment.deleteMany({ where: { bill: billWhere } });
        const billItems = await tx.billItem.deleteMany({ where: { bill: billWhere } });
        const orders = await tx.order.deleteMany({ where: orderScope(restaurantIds, billWhere) });
        const bills = await tx.bill.deleteMany({ where: billWhere });

        const standOrderItems = await tx.standOrderItem.deleteMany({ where: { order: { organizationId } } });
        const tillzStands = await tx.tillzStand.deleteMany({
          where: { OR: [{ organizationId }, { restaurantId: { in: restaurantIds } }] },
        });
        const standOrders = await tx.standOrder.deleteMany({ where: { organizationId } });

        const tables = await tx.table.deleteMany({ where: { location: { restaurantId: { in: restaurantIds } } } });
        const menuCategories = await tx.menuCategory.deleteMany({ where: { restaurantId: { in: restaurantIds } } });
        const staffAccounts = await tx.staffAccount.deleteMany({ where: { restaurantId: { in: restaurantIds } } });
        const memberships = await tx.membership.deleteMany({ where: { organizationId } });
        // Cascades whatever is left under a restaurant: locations, QR tokens,
        // cash-drawer sessions, Square mappings, customer requests, ...
        const restaurants = await tx.restaurant.deleteMany({ where: { organizationId } });
        // Cascades AuditLog and StaffInvite.
        await tx.organization.delete({ where: { id: organizationId } });

        return {
          refunds: refunds.count,
          payments: payments.count,
          billItems: billItems.count,
          orders: orders.count,
          bills: bills.count,
          standOrderItems: standOrderItems.count,
          tillzStands: tillzStands.count,
          standOrders: standOrders.count,
          tables: tables.count,
          menuCategories: menuCategories.count,
          staffAccounts: staffAccounts.count,
          memberships: memberships.count,
          restaurants: restaurants.count,
        } satisfies PurgeCounts;
      },
      // One all-or-nothing transaction: a failure anywhere rolls the whole
      // purge back, leaving the retained records exactly as they were.
      { timeout: 120_000, maxWait: 15_000 },
    );

    log.info("account.purge_completed", { organizationId, adminUserId, ...counts });
    return { ok: true, counts };
  } catch (e) {
    log.error("account.purge_failed", {
      organizationId,
      adminUserId,
      message: e instanceof Error ? e.message : String(e),
    });
    return { error: `The purge failed and was rolled back — nothing was deleted. (${e instanceof Error ? e.message : "unknown error"})` };
  }
}
