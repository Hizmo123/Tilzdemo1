"use server";

import { revalidatePath } from "next/cache";
import { getAuthz, getTenantContext } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  parseMenuImportCsv,
  buildImportPreview,
  commitMenuImport,
  type ImportPreviewCategory,
  type RowIssue,
} from "@/lib/menu-import";

async function requireRestaurantId(): Promise<string | null> {
  const { membership } = await getTenantContext();
  return membership?.organization.restaurants[0]?.id ?? null;
}

export type PreviewState =
  | { error: string }
  | {
      ok: true;
      categories: ImportPreviewCategory[];
      errors: RowIssue[];
      warnings: RowIssue[];
      rowCount: number;
    };

// Parses and validates the uploaded CSV and shows what it would create —
// nothing is written to the database here.
export async function previewMenuImportAction(csvText: string): Promise<PreviewState> {
  const authz = await getAuthz();
  if (!authz.can("menu:manage"))
    return { error: "You don't have permission to edit the menu." };
  const restaurantId = await requireRestaurantId();
  if (!restaurantId) return { error: "Create your restaurant first." };

  if (csvText.length > 2_000_000) {
    return { error: "That file is too large. Split it into smaller batches." };
  }

  const { rows, errors, warnings } = parseMenuImportCsv(csvText);
  if (rows.length === 0 && errors.length === 0) {
    return { error: "No item rows found in that file." };
  }

  const categories = await buildImportPreview(restaurantId, rows);
  return { ok: true, categories, errors, warnings, rowCount: rows.length };
}

export type ImportMode = "add" | "replace";

export type CommitState =
  | { error: string }
  | {
      ok: true;
      categoriesCreated: number;
      itemsCreated: number;
      itemsSkipped: number;
      categoriesDeleted: number;
      itemsDeleted: number;
    };

// Re-parses and re-validates the same file rather than trusting a client-held
// preview — the menu may have changed since the preview was shown, and the
// server never trusts client state for a write. Blocking errors are
// re-checked here too, so a preview can't be raced or bypassed.
//
// mode "replace" deletes the ENTIRE existing menu before importing — the
// client already gates this behind a typed confirmation
// (menu-import-form.tsx), but that's a UI convenience, not the guard: mode is
// just a plain string parameter here, so this re-validates the CSV exactly
// as "add" mode does and never trusts anything else about what's being
// deleted beyond the caller's own restaurantId.
export async function commitMenuImportAction(
  csvText: string,
  mode: ImportMode = "add",
): Promise<CommitState> {
  const authz = await getAuthz();
  if (!authz.can("menu:manage"))
    return { error: "You don't have permission to edit the menu." };
  const restaurantId = await requireRestaurantId();
  if (!restaurantId) return { error: "Create your restaurant first." };

  const { rows, errors } = parseMenuImportCsv(csvText);
  if (errors.length > 0) {
    return { error: "Fix the highlighted rows and re-upload before importing." };
  }
  if (rows.length === 0) return { error: "No item rows found in that file." };

  const result = await commitMenuImport(restaurantId, rows, mode);

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: mode === "replace" ? "menu.imported_replace" : "menu.imported",
    resourceType: "Restaurant",
    resourceId: restaurantId,
    metadata: { mode, ...result },
  });

  revalidatePath("/dashboard/menu");
  return { ok: true, ...result };
}
