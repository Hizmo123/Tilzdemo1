"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  requireActiveLocation,
  getOwnedTable,
  getAuthz,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/tokens";
import { audit } from "@/lib/audit";
import { canCreateTable, getEntitlements } from "@/lib/entitlements";
import { activateStandBySerial } from "@/lib/stands";
import { isFullyStaffedMode } from "@/lib/onboarding-options";

export type TableActionState = { error?: string };

const createTableSchema = z.object({
  label: z.string().trim().min(1, "Enter a table name or number.").max(40),
  section: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? v : null)),
});

export async function createTable(
  _prev: TableActionState,
  formData: FormData,
): Promise<TableActionState> {
  const authz = await getAuthz();
  if (!authz.can("tables:manage"))
    return { error: "You don't have permission to manage tables." };

  // Table count is a plan limit (scale, not the core loop) — see
  // lib/entitlements.ts. Only blocks creating a NEW table past the limit;
  // existing tables are never hidden or disabled by this.
  if (authz.membership) {
    const check = await canCreateTable(authz.membership.organizationId);
    if (!check.allowed) return { error: check.reason };
  }

  // Fully staffed (staff take orders AND handle payment): a customer never
  // scans a table QR, so minting a new one is never right regardless of how
  // this Server Action is reached (the Tables page's own "Add a table" form
  // is already hidden in this mode — see dashboard/tables/page.tsx). This
  // never touches EXISTING tables, only blocks creating new ones.
  const restaurant = authz.membership?.organization.restaurants[0];
  if (restaurant && isFullyStaffedMode(restaurant.customerOrdering, restaurant.customerPayment)) {
    return {
      error: "This venue's service mode doesn't use per-table QR codes — see Settings → Service.",
    };
  }

  const { location } = await requireActiveLocation();

  const parsed = createTableSchema.safeParse({
    label: formData.get("label"),
    section: formData.get("section"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const table = await prisma.$transaction(async (tx) => {
    const t = await tx.table.create({
      data: {
        locationId: location.id,
        label: parsed.data.label,
        section: parsed.data.section,
      },
    });
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await tx.qrToken.create({
          data: { token: generateToken(), tableId: t.id },
        });
        break;
      } catch (e) {
        if (attempt === 4) throw e;
      }
    }
    return t;
  });

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "table.created",
    resourceType: "Table",
    resourceId: table.id,
    metadata: { label: table.label, section: table.section },
  });

  revalidatePath("/dashboard/tables");
  return {};
}

// Claims a physical Tillz stand onto this table by its printed serial — the
// only place a stand's tableId is ever set (see lib/stands.ts). Scoped to the
// signed-in user's own org/restaurant on both ends.
export async function activateStandForTable(
  tableId: string,
  _prev: TableActionState,
  formData: FormData,
): Promise<TableActionState> {
  const authz = await getAuthz();
  if (!authz.can("tables:manage"))
    return { error: "You don't have permission to manage tables." };
  if (!authz.membership) return { error: "No organization found." };

  // dashboard/tables/layout.tsx's requireOrdering() only protects the
  // RENDERED page — a Server Action is invoked directly and isn't wrapped
  // by any page layout. A Lite org has tableLimit: 0 so createTable already
  // blocks NEW tables, but a table row can still exist from before a
  // downgrade — this stops that leftover table's stand/QR from being
  // reactivated on a plan that's supposed to be menu-only.
  const ent = await getEntitlements(authz.membership.organizationId);
  if (!ent.ordering) {
    return { error: "This venue's current plan doesn't include live table ordering." };
  }

  const table = await getOwnedTable(authz.membership!.organizationId, tableId);
  if (!table) return { error: "Table not found." };

  const serial = String(formData.get("serial") ?? "").trim();
  if (!serial) return { error: "Enter the serial printed on the stand." };

  const result = await activateStandBySerial({
    organizationId: authz.membership.organizationId,
    restaurantId: table.location.restaurant.id,
    serial,
    tableId: table.id,
  });
  if ("error" in result) return { error: result.error };

  await audit({
    organizationId: authz.membership.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "stand.activated",
    resourceType: "Table",
    resourceId: table.id,
    metadata: { serial },
  });

  revalidatePath(`/dashboard/tables/${tableId}`);
  return {};
}

// Resolves whatever the camera decoded (stand-scanner.tsx) to a serial the
// EXISTING activateStandForTable action above can use unchanged — scanning
// only changes how the serial gets into that form's input.
//
// Today's actual printed stand QR encodes /s/<qrToken> (see lib/qr.ts's
// standQrPng and lib/urls.ts#standUrl) — the CUSTOMER-facing redirect code,
// not the human-readable serial ("TZ-000123") staff type in manually. There
// is no separate machine-readable encoding of the serial on a stand today;
// that would be a print-spec change on the hardware side, not something
// fixable here (see the task report). So this tries two things, in order:
//   1. The scanned text IS already a bare serial (matches TZ-###### — covers
//      a future print spec that encodes it directly, or someone scanning a
//      printed/typed serial some other way).
//   2. The scanned text is a stand URL (today's real case) — extract its
//      qrToken and look up that SAME stand's serial, scoped to this org, so
//      scan-to-activate genuinely works against stands shipped today.
// Anything else is an unrecognised code, reported as an error so the caller
// can retry or fall back to typing.
const SERIAL_FORMAT = /^TZ-\d+$/i;
const QR_TOKEN_IN_PATH = /\/s\/([A-Za-z0-9]+)/;

export async function resolveScannedStandCode(
  rawScannedText: string,
): Promise<{ serial: string } | { error: string }> {
  const authz = await getAuthz();
  if (!authz.can("tables:manage")) return { error: "Not permitted." };
  if (!authz.membership) return { error: "No organization found." };

  const trimmed = rawScannedText.trim();
  if (!trimmed) return { error: "That code didn't decode to anything." };

  if (SERIAL_FORMAT.test(trimmed)) {
    return { serial: trimmed.toUpperCase() };
  }

  const match = trimmed.match(QR_TOKEN_IN_PATH);
  const qrToken = match?.[1];
  if (qrToken) {
    const stand = await prisma.tillzStand.findFirst({
      where: { qrToken, organizationId: authz.membership.organizationId },
      select: { serial: true },
    });
    if (stand) return { serial: stand.serial };
  }

  return { error: "That doesn't look like a Tillz stand code. Try again or type the serial." };
}

export async function regenerateQr(tableId: string): Promise<TableActionState> {
  const authz = await getAuthz();
  if (!authz.can("tables:manage"))
    return { error: "You don't have permission to manage tables." };
  if (!authz.membership) return { error: "No organization found." };

  // See activateStandForTable's comment above — this Server Action is
  // reachable directly, bypassing the page-level requireOrdering() guard.
  // Lite already has its one shared menu QR; it must not be able to mint
  // (or re-mint) a per-table one for a leftover table from before a
  // downgrade.
  const ent = await getEntitlements(authz.membership.organizationId);
  if (!ent.ordering) {
    return { error: "This venue's current plan doesn't include live table ordering." };
  }

  const table = await getOwnedTable(authz.membership!.organizationId, tableId);
  if (!table) return { error: "Table not found." };

  await prisma.$transaction(async (tx) => {
    await tx.qrToken.updateMany({
      where: { tableId: table.id, active: true },
      data: { active: false, revokedAt: new Date() },
    });
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await tx.qrToken.create({
          data: { token: generateToken(), tableId: table.id },
        });
        break;
      } catch (e) {
        if (attempt === 4) throw e;
      }
    }
  });

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "table.qr.regenerated",
    resourceType: "Table",
    resourceId: table.id,
    metadata: { label: table.label },
  });

  revalidatePath(`/dashboard/tables/${tableId}`);
  revalidatePath("/dashboard/tables");
  return {};
}

export async function setTableActive(
  tableId: string,
  active: boolean,
): Promise<TableActionState> {
  const authz = await getAuthz();
  if (!authz.can("tables:manage"))
    return { error: "You don't have permission to manage tables." };
  if (!authz.membership) return { error: "No organization found." };

  // See activateStandForTable's comment above.
  const ent = await getEntitlements(authz.membership.organizationId);
  if (!ent.ordering) {
    return { error: "This venue's current plan doesn't include live table ordering." };
  }

  const table = await getOwnedTable(authz.membership!.organizationId, tableId);
  if (!table) return { error: "Table not found." };

  await prisma.table.update({ where: { id: table.id }, data: { active } });

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "table.availability",
    resourceType: "Table",
    resourceId: table.id,
    metadata: { label: table.label, active },
  });

  revalidatePath(`/dashboard/tables/${tableId}`);
  revalidatePath("/dashboard/tables");
  return {};
}
