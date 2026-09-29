import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";
import { sendEmail } from "@/lib/email";
import { revoke } from "@/lib/square/oauth";
import { deleteOrganizationFiles } from "@/lib/account-storage";
import { ACCOUNT_RETENTION_YEARS, purgeEligibleFrom } from "@/lib/account-retention";

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

// ---- Self-service account deletion -----------------------------------------
//
// Closes the account IMMEDIATELY on the owner's confirmation — no request
// queue, no waiting on a human. What that means concretely:
//
//   Closed at once         login (owner, team, every staff PIN), customer
//                          ordering (every venue is unpublished), the
//                          subscription, Square access, and all non-financial
//                          content: menu, images/uploads, staff accounts and
//                          pending invites, branding.
//   Retained, unreachable  Payment, Refund, Bill, BillItem, Order and
//                          StandOrder rows (plus the Organization/Restaurant/
//                          Table rows they hang off). Paid bills are tax
//                          invoices with a 5-year statutory retention period
//                          in Australia. They stay until
//                          deletionPurgeEligibleAt, after which a platform
//                          admin may hard-delete them
//                          (lib/admin/account-purge.ts, /admin/deletions).
//
// DO NOT delete Table, Location or Restaurant rows here: Bill.tableId and
// most other relations are onDelete: Cascade, so removing a Table would
// cascade into its Bills. Only Payment/Refund are Restrict — unpaid or
// counter bills would be silently wiped.
//
// The ORDER of operations is the safety design: the first write is one
// atomic "claim" (updateMany guarded on deletionExecutedAt/deactivatedAt
// being null) that both blocks login and makes a double-execution
// impossible. Cleanup then runs best-effort — an account that is closed but
// has a stray file left is the acceptable failure; an account half-cleaned
// and still usable is not. Failures are returned and logged, never thrown.

export type AccountDeletionResult =
  | { ok: true; orgName: string; retainedUntil: Date; cleanupFailures: string[] }
  | { error: string };

export async function executeAccountDeletion(
  organizationId: string,
  confirmedByEmail: string,
): Promise<AccountDeletionResult> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      planStatus: true,
      deactivatedAt: true,
      deletionExecutedAt: true,
      restaurants: { select: { id: true } },
    },
  });
  if (!org) return { error: "Account not found." };
  if (org.deletionExecutedAt || org.planStatus === "deleted") {
    return { error: "This account has already been deleted." };
  }
  if (org.deactivatedAt) {
    return { error: "This account is suspended, so it can't be deleted from here. Contact Tillz support." };
  }

  const now = new Date();
  const retainedUntil = purgeEligibleFrom(now);

  // The atomic claim. deactivatedAt is set to the same instant so login is
  // blocked through the EXISTING mechanism (dashboard/layout.tsx and
  // lib/staff-auth.ts gate on it — neither is touched by this feature).
  //
  // Subscription: dashboard/billing/actions.ts#cancelSubscription is an
  // authz-bound server action whose end state is "Lite, active" — wrong for
  // a closing account, so it can't be called here. This mirrors what it
  // clears (plan -> LITE, cardLast4, trialEndsAt) but lands on planStatus
  // "deleted", which is also what makes isOrgSubscribed() false. hasUsedTrial
  // is left alone. There is no real payment provider yet (see the
  // TODO(stripe) markers), so there is no external charge to cancel.
  const claimed = await prisma.organization.updateMany({
    where: {
      id: organizationId,
      deletionExecutedAt: null,
      deactivatedAt: null,
      planStatus: { not: "deleted" },
    },
    data: {
      deactivatedAt: now,
      deactivatedByEmail: confirmedByEmail,
      deletionExecutedAt: now,
      deletedByEmail: confirmedByEmail,
      deletionPurgeEligibleAt: retainedUntil,
      planStatus: "deleted",
      plan: "LITE",
      cardLast4: null,
      trialEndsAt: null,
      reactivationToken: null,
      reactivationTokenExpiresAt: null,
    },
  });
  if (claimed.count !== 1) {
    return { error: "This account was just changed by someone else. Reload the page and check its status." };
  }

  const restaurantIds = org.restaurants.map((r) => r.id);
  const failures: string[] = [];
  const attempt = async (label: string, work: () => Promise<unknown>) => {
    try {
      await work();
    } catch (e) {
      failures.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // Stops customer ordering instantly (the /v and /m pages both refuse an
  // unpublished restaurant) and resets branding/contact fields. Deliberately
  // keeps name, slug, abn, timezone, currency: bills retained as tax
  // invoices render the venue's name and ABN.
  await attempt("unpublish and reset branding", () =>
    prisma.restaurant.updateMany({
      where: { organizationId },
      data: {
        published: false,
        logoUrl: null,
        coverUrl: null,
        bgImageUrl: null,
        bgPatternKey: null,
        brandColor: null,
        tagline: null,
        instagramHandle: null,
        websiteUrl: null,
        ownerPhone: null,
        kitchenStations: [],
      },
    }),
  );

  // Square OAuth tokens: revoke with Square (best-effort, exactly like the
  // Integrations page's own Disconnect) then delete the stored credentials.
  await attempt("disconnect Square", async () => {
    const connections = await prisma.squareConnection.findMany({
      where: { restaurant: { organizationId } },
    });
    for (const connection of connections) {
      try {
        await revoke(connection);
      } catch {
        // Same policy as disconnectSquare(): a failed revoke never blocks
        // removing our stored token.
      }
      await prisma.squareConnection.delete({ where: { id: connection.id } });
    }
  });

  await attempt("delete uploaded files", async () => {
    const result = await deleteOrganizationFiles(organizationId, restaurantIds);
    failures.push(...result.failures);
  });

  // Menu content. MenuCategory -> MenuItem -> modifiers cascade;
  // BillItem.menuItemId is onDelete: SetNull, and BillItem keeps its own
  // nameSnapshot/unitPriceCents, so retained bills stay fully readable.
  await attempt("delete menu", () =>
    prisma.menuCategory.deleteMany({ where: { restaurant: { organizationId } } }),
  );

  // Staff PINs/accounts (deleting them also invalidates any live staff
  // session cookie — verification re-loads the account) and unaccepted
  // invites.
  await attempt("delete staff accounts", () =>
    prisma.staffAccount.deleteMany({ where: { restaurant: { organizationId } } }),
  );
  await attempt("revoke pending invites", () => prisma.staffInvite.deleteMany({ where: { organizationId } }));
  if (failures.length > 0) {
    log.error("account.deletion_cleanup_incomplete", {
      organizationId,
      failureCount: failures.length,
      failures: failures.join(" | ").slice(0, 1500),
    });
  }

  if (confirmedByEmail) await sendAccountClosedEmail(confirmedByEmail, org.name, retainedUntil);

  return { ok: true, orgName: org.name, retainedUntil, cleanupFailures: failures };
}

async function sendAccountClosedEmail(to: string, orgName: string, retainedUntil: Date) {
  const until = retainedUntil.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  const years = ACCOUNT_RETENTION_YEARS;
  const result = await sendEmail({
    to,
    subject: `${orgName} has been closed on Tillz`,
    text: [
      `The Tillz account for ${orgName} has been permanently closed.`,
      "",
      "What happened straight away:",
      "- Nobody on your team can sign in any more, including staff PIN logins.",
      "- Your tables and QR codes no longer take orders.",
      "- Your subscription was cancelled.",
      "- Your menu, images, uploaded files, staff accounts and branding were deleted.",
      "",
      `What we keep: records of payments and refunds, and the bills and orders they belong to, are kept privately for ${years} years (until ${until}) because Australian tax law requires it. You can't access them, and we don't use them for anything else. After that date they're permanently deleted.`,
      "",
      "This can't be undone. If you didn't do this, contact Tillz support straight away.",
    ].join("\n"),
    html: `
      <p>The Tillz account for <strong>${escapeHtml(orgName)}</strong> has been permanently closed.</p>
      <p><strong>What happened straight away</strong></p>
      <ul>
        <li>Nobody on your team can sign in any more, including staff PIN logins.</li>
        <li>Your tables and QR codes no longer take orders.</li>
        <li>Your subscription was cancelled.</li>
        <li>Your menu, images, uploaded files, staff accounts and branding were deleted.</li>
      </ul>
      <p><strong>What we keep</strong><br/>Records of payments and refunds, and the bills and orders they belong to, are kept privately for ${years} years (until ${until}) because Australian tax law requires it. You can't access them, and we don't use them for anything else. After that date they're permanently deleted.</p>
      <p style="color:#888;font-size:13px">This can't be undone. If you didn't do this, contact Tillz support straight away.</p>
    `,
  });
  // The account is already closed by now — a failed email is logged, never
  // surfaced as a failed deletion.
  if (!result.ok) log.warn("account.closed_email_failed", { error: result.error ?? "unknown" });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Deactivation is no longer self-service: Organization.deactivatedAt is set
// only by a platform admin (lib/admin/account-actions.ts#adminSuspendOrg) and
// cleared by adminReactivateOrg. The login blocks in dashboard/layout.tsx and
// lib/staff-auth.ts key off deactivatedAt regardless of who set it. The
// reactivationToken columns remain on the schema (unused, nullable) —
// adminReactivateOrg already clears them defensively.
