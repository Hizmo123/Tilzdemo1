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

export async function regenerateQr(tableId: string): Promise<TableActionState> {
  const authz = await getAuthz();
  if (!authz.can("tables:manage"))
    return { error: "You don't have permission to manage tables." };

  const table = await getOwnedTable(authz.user.id, tableId);
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

  const table = await getOwnedTable(authz.user.id, tableId);
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
