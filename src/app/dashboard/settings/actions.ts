"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { z } from "zod";
import { getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { createServiceClient, MENU_IMAGE_BUCKET } from "@/lib/supabase/service";
import { parseHours } from "@/lib/hours";
import { normalizeAuPhone } from "@/lib/phone";
import { sendOtp, verifyOtp } from "@/lib/otp";
// Constants live in a plain module — a "use server" file may only export async
// functions, so exporting these arrays from here breaks them at runtime.
import {
  CURRENCIES,
  THEMES,
  THEME_MODES,
  FONT_THEMES_KEYS,
  TIMEZONES,
} from "./constants";

export type SettingsState = { error?: string; saved?: boolean };

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(80),
  abn: z
    .string()
    .trim()
    .transform((s) => s.replace(/\s+/g, ""))
    .refine((v) => v === "" || /^\d{11}$/.test(v), "ABN must be 11 digits.")
    .optional(),
  timezone: z.enum(TIMEZONES),
  currency: z.enum(CURRENCIES),
  brandColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Pick a valid colour.")
    .optional()
    .or(z.literal("")),
  theme: z.enum(THEMES),
  themeMode: z.enum(THEME_MODES),
  fontTheme: z.enum(FONT_THEMES_KEYS),
  tipEnabled: z.boolean(),
  tipPresets: z.array(z.number().int().min(1).max(100)).max(5),
  customerOrdering: z.boolean(),
  customerPayment: z.boolean(),
  staffApproval: z.boolean(),
  paymentTiming: z.enum(["before", "after"]),
  takeawayEnabled: z.boolean(),
});

async function currentRestaurant() {
  const authz = await getAuthz();
  const restaurant = authz.membership?.organization.restaurants[0] ?? null;
  return { authz, restaurant };
}

export async function updateSettings(input: {
  name: string;
  abn: string;
  timezone: string;
  currency: string;
  brandColor: string;
  theme: string;
  themeMode: string;
  fontTheme: string;
  tipEnabled: boolean;
  tipPresets: number[];
  customerOrdering: boolean;
  customerPayment: boolean;
  staffApproval: boolean;
  paymentTiming: string;
  takeawayEnabled: boolean;
  hours: unknown;
}): Promise<SettingsState> {
  const { authz, restaurant } = await currentRestaurant();
  if (!authz.can("settings:manage"))
    return { error: "You don't have permission to change settings." };
  if (!restaurant) return { error: "Create your restaurant first." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: {
      name: parsed.data.name,
      abn: parsed.data.abn ? parsed.data.abn : null,
      timezone: parsed.data.timezone,
      currency: parsed.data.currency,
      brandColor: parsed.data.brandColor ? parsed.data.brandColor : null,
      theme: parsed.data.theme,
      themeMode: parsed.data.themeMode,
      fontTheme: parsed.data.fontTheme,
      tipEnabled: parsed.data.tipEnabled,
      tipPresets: parsed.data.tipPresets.length
        ? parsed.data.tipPresets
        : [5, 10, 15],
      customerOrdering: parsed.data.customerOrdering,
      customerPayment: parsed.data.customerPayment,
      staffApproval: parsed.data.staffApproval,
      paymentTiming: parsed.data.paymentTiming,
      takeawayEnabled: parsed.data.takeawayEnabled,
      // Only overwrite hours when the form sent a valid 7-day set; otherwise
      // leave whatever's there (null = always open).
      ...(parseHours(input.hours) ? { hours: parseHours(input.hours)! } : {}),
    },
  });

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "restaurant.settings_updated",
    resourceType: "Restaurant",
    resourceId: restaurant.id,
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { saved: true };
}

export async function uploadLogo(formData: FormData): Promise<SettingsState> {
  const { authz, restaurant } = await currentRestaurant();
  if (!authz.can("settings:manage")) return { error: "Not permitted." };
  if (!restaurant) return { error: "Create your restaurant first." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No image received." };
  if (file.size > 3 * 1024 * 1024) return { error: "Image is too large." };
  if (!file.type.startsWith("image/")) return { error: "That isn't an image." };

  const supabase = createServiceClient();
  const { data: bucket } = await supabase.storage.getBucket(MENU_IMAGE_BUCKET);
  if (!bucket) {
    await supabase.storage.createBucket(MENU_IMAGE_BUCKET, { public: true });
  }

  const path = `${restaurant.id}/logo-${randomBytes(6).toString("hex")}.jpg`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from(MENU_IMAGE_BUCKET)
    .upload(path, buffer, { contentType: "image/jpeg", upsert: true });
  if (upErr) return { error: "Upload failed. Please try again." };

  const { data: pub } = supabase.storage
    .from(MENU_IMAGE_BUCKET)
    .getPublicUrl(path);

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { logoUrl: pub.publicUrl },
  });

  revalidatePath("/dashboard/settings");
  return { saved: true };
}

export async function removeLogo(): Promise<SettingsState> {
  const { authz, restaurant } = await currentRestaurant();
  if (!authz.can("settings:manage")) return { error: "Not permitted." };
  if (!restaurant) return { error: "Create your restaurant first." };

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { logoUrl: null },
  });
  revalidatePath("/dashboard/settings");
  return { saved: true };
}

export async function uploadCover(formData: FormData): Promise<SettingsState> {
  const { authz, restaurant } = await currentRestaurant();
  if (!authz.can("settings:manage")) return { error: "Not permitted." };
  if (!restaurant) return { error: "Create your restaurant first." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No image received." };
  if (file.size > 3 * 1024 * 1024) return { error: "Image is too large." };
  if (!file.type.startsWith("image/")) return { error: "That isn't an image." };

  const supabase = createServiceClient();
  const { data: bucket } = await supabase.storage.getBucket(MENU_IMAGE_BUCKET);
  if (!bucket) await supabase.storage.createBucket(MENU_IMAGE_BUCKET, { public: true });

  const path = `${restaurant.id}/cover-${randomBytes(6).toString("hex")}.jpg`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from(MENU_IMAGE_BUCKET)
    .upload(path, buffer, { contentType: "image/jpeg", upsert: true });
  if (upErr) return { error: "Upload failed. Please try again." };

  const { data: pub } = supabase.storage.from(MENU_IMAGE_BUCKET).getPublicUrl(path);
  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { coverUrl: pub.publicUrl },
  });
  revalidatePath("/dashboard/settings");
  return { saved: true };
}

export async function removeCover(): Promise<SettingsState> {
  const { authz, restaurant } = await currentRestaurant();
  if (!authz.can("settings:manage")) return { error: "Not permitted." };
  if (!restaurant) return { error: "Create your restaurant first." };

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { coverUrl: null },
  });
  revalidatePath("/dashboard/settings");
  return { saved: true };
}

export async function uploadBackground(
  formData: FormData,
): Promise<SettingsState> {
  const { authz, restaurant } = await currentRestaurant();
  if (!authz.can("settings:manage")) return { error: "Not permitted." };
  if (!restaurant) return { error: "Create your restaurant first." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No image received." };
  if (file.size > 4 * 1024 * 1024) return { error: "Image is too large." };
  if (!file.type.startsWith("image/")) return { error: "That isn't an image." };

  const supabase = createServiceClient();
  const { data: bucket } = await supabase.storage.getBucket(MENU_IMAGE_BUCKET);
  if (!bucket) await supabase.storage.createBucket(MENU_IMAGE_BUCKET, { public: true });

  const path = `${restaurant.id}/bg-${randomBytes(6).toString("hex")}.jpg`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from(MENU_IMAGE_BUCKET)
    .upload(path, buffer, { contentType: "image/jpeg", upsert: true });
  if (upErr) return { error: "Upload failed. Please try again." };

  const { data: pub } = supabase.storage.from(MENU_IMAGE_BUCKET).getPublicUrl(path);
  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { bgImageUrl: pub.publicUrl },
  });
  revalidatePath("/dashboard/settings");
  return { saved: true };
}

// ---- Owner phone verification ----------------------------------------------

export async function sendOwnerVerification(phone: string) {
  const { authz, restaurant } = await currentRestaurant();
  if (!authz.can("settings:manage")) return { error: "Not permitted." };
  if (!restaurant) return { error: "Create your restaurant first." };
  const e164 = normalizeAuPhone(phone);
  if (!e164) return { error: "Enter a valid Australian mobile (e.g. 04xx xxx xxx)." };
  const res = await sendOtp(e164, "owner_verify");
  if ("error" in res) return res;
  return { ok: true as const, devCode: res.devCode };
}

export async function verifyOwnerVerification(phone: string, code: string) {
  const { authz, restaurant } = await currentRestaurant();
  if (!authz.can("settings:manage")) return { error: "Not permitted." };
  if (!restaurant) return { error: "Create your restaurant first." };
  const e164 = normalizeAuPhone(phone);
  if (!e164) return { error: "Enter a valid Australian mobile." };
  const res = await verifyOtp(e164, code, "owner_verify");
  if ("error" in res) return res;
  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { ownerPhone: e164 },
  });
  revalidatePath("/dashboard/settings");
  return { ok: true as const };
}

export async function removeBackground(): Promise<SettingsState> {
  const { authz, restaurant } = await currentRestaurant();
  if (!authz.can("settings:manage")) return { error: "Not permitted." };
  if (!restaurant) return { error: "Create your restaurant first." };

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { bgImageUrl: null },
  });
  revalidatePath("/dashboard/settings");
  return { saved: true };
}
