"use server";

import { randomBytes } from "crypto";
import { getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createServiceClient,
  ensurePublicBucket,
  describeStorageError,
  StorageNotConfiguredError,
} from "@/lib/supabase/service";
import { log } from "@/lib/log";

export type DesignUploadState =
  | { error: string }
  | { url: string; fileName: string };

// Print artwork, not a menu photo — own bucket (never the image-only
// menu-images bucket, which is created with allowedMimeTypes locked to
// jpeg/png/webp and would reject a PDF outright) and no compressImage: that
// pipeline re-encodes to JPEG at a fixed quality, which is exactly the kind
// of degradation a print-ready file must not go through.
// Not exported: a "use server" file may only export async functions (see
// the same note on dashboard/settings/constants.ts) — a plain constant
// export here breaks that at runtime.
const STAND_DESIGN_BUCKET = "stand-designs";

// Cloned from uploadMenuImage's shape (dashboard/menu/image-actions.ts) —
// auth check -> validate File -> ensure bucket -> upload -> getPublicUrl —
// but validated against THIS product's own limits (admin-set per product,
// see StandProduct.maxDesignSizeMb/acceptedDesignMimeTypes) rather than a
// fixed constant, and returns the URL without writing anywhere: the order
// this design belongs to doesn't exist yet. orderStands (actions.ts) is what
// actually attaches the returned URL to a StandOrder once the order is
// placed.
export async function uploadStandOrderDesign(
  productId: string,
  formData: FormData,
): Promise<DesignUploadState> {
  const authz = await getAuthz();
  if (!authz.can("tables:manage"))
    return { error: "You don't have permission to order stands." };
  if (!authz.membership) return { error: "No organization found." };

  const product = await prisma.standProduct.findUnique({ where: { id: productId } });
  if (!product || !product.active) return { error: "That product is no longer available." };
  if (!product.allowsCustomDesign) return { error: "This product doesn't take a custom design." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No file received." };

  const maxBytes = product.maxDesignSizeMb * 1024 * 1024;
  if (file.size > maxBytes) return { error: `File is too large — max ${product.maxDesignSizeMb} MB.` };
  if (!product.acceptedDesignMimeTypes.includes(file.type)) {
    return { error: "That file type isn't accepted for this product." };
  }

  let supabase;
  try {
    supabase = createServiceClient();
    await ensurePublicBucket(supabase, STAND_DESIGN_BUCKET);
  } catch (e) {
    if (e instanceof StorageNotConfiguredError) return { error: e.message };
    log.error("stand_design.bucket_failed", {
      productId,
      message: e instanceof Error ? e.message : String(e),
    });
    return { error: "Couldn't prepare design storage. Please try again." };
  }

  const ext = extensionFor(file.type, file.name);
  const organizationId = authz.membership.organizationId;
  const path = `${organizationId}/${randomBytes(8).toString("hex")}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from(STAND_DESIGN_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true });
  if (upErr) {
    log.error("stand_design.upload_failed", { productId, message: upErr.message });
    return { error: describeStorageError(upErr.message) };
  }

  const { data: pub } = supabase.storage.from(STAND_DESIGN_BUCKET).getPublicUrl(path);
  return { url: pub.publicUrl, fileName: file.name };
}

function extensionFor(mimeType: string, originalName: string): string {
  const known: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "application/pdf": ".pdf",
    "image/svg+xml": ".svg",
  };
  if (known[mimeType]) return known[mimeType];
  const m = originalName.match(/\.[a-zA-Z0-9]+$/);
  return m ? m[0] : "";
}
