"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import {
  createServiceClient,
  describeStorageError,
  MENU_IMAGE_BUCKET,
  StorageNotConfiguredError,
} from "@/lib/supabase/service";
import { log } from "@/lib/log";

export type ImageActionState = { error?: string; url?: string };

const MAX_BYTES = 3 * 1024 * 1024; // 3 MB safety cap (client already compresses)

// Same bucket menu item photos use (see dashboard/menu/image-actions.ts) —
// reusing the storage path this project already has rather than standing up
// a second uploader. Product images live under their own "stand-products/"
// prefix in that bucket since, unlike a menu item, a StandProduct has no
// restaurantId to namespace by.
async function ensureBucket(supabase: ReturnType<typeof createServiceClient>) {
  const { data } = await supabase.storage.getBucket(MENU_IMAGE_BUCKET);
  if (!data) {
    await supabase.storage.createBucket(MENU_IMAGE_BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });
  }
}

function pathFromUrl(url: string): string | null {
  const marker = `/object/public/${MENU_IMAGE_BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

export async function uploadStandProductImage(
  productId: string,
  formData: FormData,
): Promise<ImageActionState> {
  await requirePlatformAdmin();

  const product = await prisma.standProduct.findUnique({ where: { id: productId } });
  if (!product) return { error: "Product not found." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No image received." };
  if (file.size > MAX_BYTES) return { error: "Image is too large." };
  if (!file.type.startsWith("image/")) return { error: "That isn't an image." };

  let supabase;
  try {
    supabase = createServiceClient();
    await ensureBucket(supabase);
  } catch (e) {
    if (e instanceof StorageNotConfiguredError) return { error: e.message };
    log.error("stand_product_image.bucket_failed", {
      productId,
      message: e instanceof Error ? e.message : String(e),
    });
    return { error: "Couldn't prepare image storage. Please try again." };
  }

  const path = `stand-products/${productId}-${randomBytes(6).toString("hex")}.jpg`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from(MENU_IMAGE_BUCKET)
    .upload(path, buffer, { contentType: "image/jpeg", upsert: true });
  if (upErr) {
    log.error("stand_product_image.upload_failed", { productId, message: upErr.message });
    return { error: describeStorageError(upErr.message) };
  }

  const { data: pub } = supabase.storage.from(MENU_IMAGE_BUCKET).getPublicUrl(path);

  if (product.imageUrl) {
    const old = pathFromUrl(product.imageUrl);
    if (old) await supabase.storage.from(MENU_IMAGE_BUCKET).remove([old]);
  }

  await prisma.standProduct.update({
    where: { id: product.id },
    data: { imageUrl: pub.publicUrl },
  });

  revalidatePath("/admin/products");
  return { url: pub.publicUrl };
}

export async function removeStandProductImage(
  productId: string,
): Promise<ImageActionState> {
  await requirePlatformAdmin();

  const product = await prisma.standProduct.findUnique({ where: { id: productId } });
  if (!product) return { error: "Product not found." };

  if (product.imageUrl) {
    try {
      const supabase = createServiceClient();
      const path = pathFromUrl(product.imageUrl);
      if (path) await supabase.storage.from(MENU_IMAGE_BUCKET).remove([path]);
    } catch (e) {
      log.error("stand_product_image.remove_failed", {
        productId,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  await prisma.standProduct.update({ where: { id: product.id }, data: { imageUrl: null } });

  revalidatePath("/admin/products");
  return {};
}
