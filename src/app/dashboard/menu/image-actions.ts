"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { getAuthz } from "@/lib/auth";
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

async function ownedItem(itemId: string, userId: string) {
  return prisma.menuItem.findFirst({
    where: {
      id: itemId,
      category: {
        restaurant: { organization: { memberships: { some: { userId } } } },
      },
    },
    include: { category: { include: { restaurant: true } } },
  });
}

// Ensures the public menu-images bucket exists (idempotent). Auto-creating it
// means the owner needs no manual Supabase setup.
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

// Extracts the storage path from a public URL so we can delete the old file.
function pathFromUrl(url: string): string | null {
  const marker = `/object/public/${MENU_IMAGE_BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

export async function uploadMenuImage(
  itemId: string,
  formData: FormData,
): Promise<ImageActionState> {
  const authz = await getAuthz();
  if (!authz.can("menu:manage"))
    return { error: "You don't have permission to edit the menu." };

  const item = await ownedItem(itemId, authz.user.id);
  if (!item) return { error: "Item not found." };

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
    log.error("menu_image.bucket_failed", {
      itemId,
      message: e instanceof Error ? e.message : String(e),
    });
    return { error: "Couldn't prepare image storage. Please try again." };
  }

  const restaurantId = item.category.restaurant.id;
  const path = `${restaurantId}/${itemId}-${randomBytes(6).toString("hex")}.jpg`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from(MENU_IMAGE_BUCKET)
    .upload(path, buffer, { contentType: "image/jpeg", upsert: true });
  if (upErr) {
    log.error("menu_image.upload_failed", { itemId, message: upErr.message });
    return { error: describeStorageError(upErr.message) };
  }

  const { data: pub } = supabase.storage
    .from(MENU_IMAGE_BUCKET)
    .getPublicUrl(path);

  // Best-effort cleanup of the previous image.
  if (item.imageUrl) {
    const old = pathFromUrl(item.imageUrl);
    if (old) await supabase.storage.from(MENU_IMAGE_BUCKET).remove([old]);
  }

  await prisma.menuItem.update({
    where: { id: item.id },
    data: { imageUrl: pub.publicUrl },
  });

  revalidatePath("/dashboard/menu");
  return { url: pub.publicUrl };
}

export async function removeMenuImage(itemId: string): Promise<ImageActionState> {
  const authz = await getAuthz();
  if (!authz.can("menu:manage")) return { error: "Not permitted." };

  const item = await ownedItem(itemId, authz.user.id);
  if (!item) return { error: "Item not found." };

  if (item.imageUrl) {
    try {
      const supabase = createServiceClient();
      const path = pathFromUrl(item.imageUrl);
      if (path) await supabase.storage.from(MENU_IMAGE_BUCKET).remove([path]);
    } catch (e) {
      // Best-effort cleanup — the item's imageUrl is cleared either way below,
      // so a storage hiccup here just leaves an orphaned file, not a stuck UI.
      log.error("menu_image.remove_failed", {
        itemId,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  await prisma.menuItem.update({
    where: { id: item.id },
    data: { imageUrl: null },
  });

  revalidatePath("/dashboard/menu");
  return {};
}
