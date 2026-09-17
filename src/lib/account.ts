import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";
import { appBaseUrl } from "@/lib/urls";

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

const REACTIVATION_TTL_DAYS = 7;

// Pauses the account: blocks owner/team dashboard login and every staff PIN
// login across every restaurant in this org (see the checks in
// dashboard/layout.tsx and staffLogin), and marks the subscription cancelled.
// There's no real payment provider to actually cancel a charge with yet (see
// billing/page.tsx — BILLING_UI_ENABLED is off), but this records the intent
// correctly so it's already right the moment real billing lands, rather than
// silently doing nothing. Emails a reactivation link — this can only be
// undone by following that link, never from inside the dashboard, since the
// dashboard is exactly what's being blocked.
export async function deactivateAccount(
  organizationId: string,
  byEmail: string,
): Promise<{ ok: true } | { error: string }> {
  const token = generateToken(24);
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      deactivatedAt: new Date(),
      deactivatedByEmail: byEmail,
      reactivationToken: token,
      reactivationTokenExpiresAt: new Date(Date.now() + REACTIVATION_TTL_DAYS * 24 * 60 * 60 * 1000),
      planStatus: "cancelled",
    },
  });

  const link = `${appBaseUrl()}/reactivate/${token}`;
  const result = await sendEmail({
    to: byEmail,
    subject: "Your Tillz account has been deactivated",
    text: `Your account has been deactivated and your subscription cancelled. Your team can't sign in until you reactivate. To reactivate, open this link within ${REACTIVATION_TTL_DAYS} days: ${link}`,
    html: `
      <p>Your account has been deactivated and your subscription cancelled.</p>
      <p>Your team (dashboard logins and staff PIN logins) can't sign in until you reactivate.</p>
      <p><a href="${link}">Reactivate your account</a></p>
      <p style="color:#888;font-size:13px">This link expires in ${REACTIVATION_TTL_DAYS} days. If you didn't request this, contact support.</p>
    `,
  });
  if (!result.ok) return { error: "Deactivated, but the reactivation email couldn't be sent — contact support to reactivate." };
  return { ok: true };
}

// Read-only check for the reactivate page's initial render — mutating
// straight off a GET is a real footgun here (email link scanners, browser
// prefetch), same reasoning as the existing invite/[token] flow, which reads
// on the page and only mutates from an explicit button click. See
// reactivateAccount below for the actual mutation.
export async function checkReactivationToken(
  token: string,
): Promise<{ ok: true; organizationName: string } | { error: string }> {
  const org = await prisma.organization.findUnique({ where: { reactivationToken: token } });
  if (!org || !org.deactivatedAt) return { error: "This reactivation link isn't valid." };
  if (!org.reactivationTokenExpiresAt || org.reactivationTokenExpiresAt < new Date()) {
    return { error: "This reactivation link has expired. Contact support to reactivate your account." };
  }
  return { ok: true, organizationName: org.name };
}

export async function reactivateAccount(
  token: string,
): Promise<{ ok: true; organizationId: string; organizationName: string } | { error: string }> {
  const check = await checkReactivationToken(token);
  if ("error" in check) return check;

  const org = await prisma.organization.update({
    where: { reactivationToken: token },
    data: {
      deactivatedAt: null,
      deactivatedByEmail: null,
      reactivationToken: null,
      reactivationTokenExpiresAt: null,
    },
  });
  return { ok: true, organizationId: org.id, organizationName: org.name };
}
