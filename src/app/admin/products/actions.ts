"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";

export type ProductActionState = { error?: string };

const productSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(80),
  description: z.string().trim().min(1, "Enter a description.").max(500),
  type: z.enum(["QR", "NFC"]),
  priceDollars: z.number().min(0.01, "Enter a price greater than zero."),
  sortOrder: z.number().int(),
});

function parseInput(formData: FormData) {
  return productSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    type: formData.get("type"),
    priceDollars: Number(formData.get("priceDollars")),
    sortOrder: Number(formData.get("sortOrder") ?? 0),
  });
}

export async function createStandProduct(
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  await requirePlatformAdmin(); // re-checked independently of the layout — see lib/platform-admin.ts

  const parsed = parseInput(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.standProduct.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      type: parsed.data.type,
      priceCents: Math.round(parsed.data.priceDollars * 100),
      sortOrder: parsed.data.sortOrder,
    },
  });

  revalidatePath("/admin/products");
  return {};
}

export async function updateStandProduct(
  productId: string,
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  await requirePlatformAdmin();

  const product = await prisma.standProduct.findUnique({ where: { id: productId } });
  if (!product) return { error: "Product not found." };

  const parsed = parseInput(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.standProduct.update({
    where: { id: productId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      type: parsed.data.type,
      priceCents: Math.round(parsed.data.priceDollars * 100),
      sortOrder: parsed.data.sortOrder,
    },
  });

  revalidatePath("/admin/products");
  return {};
}

// Retiring only ever flips active — never a hard delete, since a past
// StandOrder can still reference this product (standProductId) and must
// keep resolving for order history.
export async function setStandProductActive(
  productId: string,
  active: boolean,
): Promise<ProductActionState> {
  await requirePlatformAdmin();

  const product = await prisma.standProduct.findUnique({ where: { id: productId } });
  if (!product) return { error: "Product not found." };

  await prisma.standProduct.update({ where: { id: productId }, data: { active } });

  revalidatePath("/admin/products");
  return {};
}
