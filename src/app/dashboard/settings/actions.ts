"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { findContrastIssue } from "@/lib/theme";
import {
  createServiceClient,
  ensurePublicBucket,
  MENU_IMAGE_BUCKET,
  StorageNotConfiguredError,
} from "@/lib/supabase/service";
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
import { COUNTRIES, hasTaxRules } from "@/lib/countries";
import { LANGUAGE_CODES } from "@/lib/languages";

export type SettingsState = { error?: string; saved?: boolean };

// The settings hub split one page into five (see the hub restructure) — a
// save from any of them needs to bust the cache for all of them, since the
// same underlying Restaurant row backs every one.
function revalidateAllSettingsPages() {
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/settings/venue");
  revalidatePath("/dashboard/settings/branding");
  revalidatePath("/dashboard/settings/service");
  revalidatePath("/dashboard/settings/hours");
  revalidatePath("/dashboard/settings/notifications");
}
export type ImageUploadState = { error?: string; url?: string };

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(80),
  country: z.enum(COUNTRIES.map((c) => c.code) as [string, ...string[]]),
  language: z.enum(LANGUAGE_CODES),
  abn: z
    .string()
    .trim()
    .transform((s) => s.replace(/\s+/g, ""))
    .refine((v) => v === "" || /^\d{11}$/.test(v), "ABN must be 11 digits.")
    .optional(),
  // Optional contact number — not a verification mechanism (see abnVerifiedAt
  // for the real "is this a registered business" check). Blank clears it.
  ownerPhone: z.string().trim().max(20).optional().or(z.literal("")),
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
  cornerStyle: z.enum(["sharp", "soft", "round"]),
  tagline: z
    .string()
    .trim()
    .max(80)
    .optional()
    .or(z.literal("")),
  menuLayout: z.enum(["list", "grid", "magazine", "minimal"]),
  cardStyle: z
    .object({
      imagePosition: z.enum(["left", "top", "none"]),
      imageAspect: z.enum(["square", "4:3", "16:9"]),
      border: z.enum(["none", "thin", "bold"]),
      shadow: z.enum(["none", "soft", "lifted"]),
      divider: z.enum(["none", "line", "space"]),
    })
    .optional(),
  typeScale: z.enum(["compact", "comfortable", "large"]),
  sectionHeaderStyle: z.enum(["plain", "underline", "pill", "bold-caps"]),
  buttonShape: z.enum(["pill", "rounded", "square"]),
  buttonFill: z.enum(["solid", "outline", "soft"]),
  bgTreatment: z.enum(["solid", "pattern", "photo"]),
  bgPatternKey: z.enum(["dots", "grid", "diagonal"]).optional().or(z.literal("")),
  bgOverlayStrength: z.number().int().min(0).max(100),
  qrForegroundColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Pick a valid colour.")
    .optional()
    .or(z.literal("")),
  qrBackgroundColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Pick a valid colour.")
    .optional()
    .or(z.literal("")),
  qrCornerStyle: z.enum(["square", "rounded"]),
  qrEmbedLogo: z.boolean(),
  qrCardTemplate: z.enum(["minimal", "branded", "bold"]),
  instagramHandle: z
    .string()
    .trim()
    .max(30)
    .transform((s) => s.replace(/^@/, ""))
    .optional()
    .or(z.literal("")),
  websiteUrl: z.string().trim().max(200).optional().or(z.literal("")),
  tipEnabled: z.boolean(),
  tipPresets: z.array(z.number().int().min(1).max(100)).max(5),
  customerOrdering: z.boolean(),
  customerPayment: z.boolean(),
  staffApproval: z.boolean(),
  paymentTiming: z.enum(["before", "after"]),
  requirePaymentBeforeOrder: z.boolean(),
  kitchenChime: z.boolean(),
  orderReadySmsEnabled: z.boolean(),
  surchargeEnabled: z.boolean(),
  // Whole or one-decimal percent, e.g. 1.7 — converted to basis points below.
  // Capped at 5% as a sanity bound against a fat-fingered entry; there's no
  // hard legal ceiling in Australia, but a card surcharge must not exceed the
  // merchant's actual cost of acceptance, and typical AU rates sit well under
  // this (spec: "a compliance problem" if this is wrong).
  surchargePercent: z.number().min(0).max(5),
});

async function currentRestaurant() {
  const authz = await getAuthz();
  const restaurant = authz.membership?.organization.restaurants[0] ?? null;
  return { authz, restaurant };
}

export async function updateSettings(input: {
  name: string;
  country: string;
  language: string;
  abn: string;
  ownerPhone: string;
  timezone: string;
  currency: string;
  brandColor: string;
  theme: string;
  themeMode: string;
  fontTheme: string;
  cornerStyle: string;
  tagline: string;
  menuLayout: string;
  cardStyle?: {
    imagePosition: string;
    imageAspect: string;
    border: string;
    shadow: string;
    divider: string;
  };
  typeScale: string;
  sectionHeaderStyle: string;
  buttonShape: string;
  buttonFill: string;
  bgTreatment: string;
  bgPatternKey: string;
  bgOverlayStrength: number;
  qrForegroundColor: string;
  qrBackgroundColor: string;
  qrCornerStyle: string;
  qrEmbedLogo: boolean;
  qrCardTemplate: string;
  instagramHandle: string;
  websiteUrl: string;
  tipEnabled: boolean;
  tipPresets: number[];
  customerOrdering: boolean;
  customerPayment: boolean;
  staffApproval: boolean;
  paymentTiming: string;
  requirePaymentBeforeOrder: boolean;
  kitchenChime: boolean;
  orderReadySmsEnabled: boolean;
  surchargeEnabled: boolean;
  surchargePercent: number;
  hours: unknown;
}): Promise<SettingsState> {
  const { authz, restaurant } = await currentRestaurant();
  if (!authz.can("settings:manage"))
    return { error: "You don't have permission to change settings." };
  if (!restaurant) return { error: "Create your restaurant first." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Legibility guardrail (A5): reject the save outright rather than silently
  // storing an appearance that would be hard to read — see
  // lib/theme.ts#findContrastIssue for exactly what's checked.
  const contrastIssue = findContrastIssue({
    theme: parsed.data.theme,
    themeMode: parsed.data.themeMode,
    brandColor: parsed.data.brandColor,
  });
  if (contrastIssue) return { error: contrastIssue };

  // Blank clears it; anything else must be a valid AU mobile — it's just a
  // contact field, but a garbled number stored as "verified-looking" data
  // helps no one either.
  let ownerPhone: string | null = null;
  if (parsed.data.ownerPhone) {
    const e164 = normalizeAuPhone(parsed.data.ownerPhone);
    if (!e164) return { error: "Enter a valid Australian mobile (e.g. 04xx xxx xxx), or leave it blank." };
    ownerPhone = e164;
  }

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: {
      name: parsed.data.name,
      country: parsed.data.country,
      language: parsed.data.language,
      abn: hasTaxRules(parsed.data.country) && parsed.data.abn ? parsed.data.abn : null,
      ownerPhone,
      timezone: parsed.data.timezone,
      currency: parsed.data.currency,
      brandColor: parsed.data.brandColor ? parsed.data.brandColor : null,
      theme: parsed.data.theme,
      themeMode: parsed.data.themeMode,
      fontTheme: parsed.data.fontTheme,
      cornerStyle: parsed.data.cornerStyle,
      tagline: parsed.data.tagline ? parsed.data.tagline : null,
      menuLayout: parsed.data.menuLayout,
      cardStyle: parsed.data.cardStyle ?? Prisma.JsonNull,
      typeScale: parsed.data.typeScale,
      sectionHeaderStyle: parsed.data.sectionHeaderStyle,
      buttonShape: parsed.data.buttonShape,
      buttonFill: parsed.data.buttonFill,
      bgTreatment: parsed.data.bgTreatment,
      bgPatternKey: parsed.data.bgPatternKey ? parsed.data.bgPatternKey : null,
      bgOverlayStrength: parsed.data.bgOverlayStrength,
      qrForegroundColor: parsed.data.qrForegroundColor ? parsed.data.qrForegroundColor : null,
      qrBackgroundColor: parsed.data.qrBackgroundColor ? parsed.data.qrBackgroundColor : null,
      qrCornerStyle: parsed.data.qrCornerStyle,
      qrEmbedLogo: parsed.data.qrEmbedLogo,
      qrCardTemplate: parsed.data.qrCardTemplate,
      instagramHandle: parsed.data.instagramHandle ? parsed.data.instagramHandle : null,
      websiteUrl: parsed.data.websiteUrl ? parsed.data.websiteUrl : null,
      tipEnabled: parsed.data.tipEnabled,
      tipPresets: parsed.data.tipPresets.length
        ? parsed.data.tipPresets
        : [5, 10, 15],
      customerOrdering: parsed.data.customerOrdering,
      customerPayment: parsed.data.customerPayment,
      staffApproval: parsed.data.staffApproval,
      paymentTiming: parsed.data.paymentTiming,
      requirePaymentBeforeOrder: parsed.data.requirePaymentBeforeOrder,
      kitchenChime: parsed.data.kitchenChime,
      orderReadySmsEnabled: parsed.data.orderReadySmsEnabled,
      surchargeEnabled: parsed.data.surchargeEnabled,
      surchargeBasisPoints: Math.round(parsed.data.surchargePercent * 100),
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

  revalidateAllSettingsPages();
  revalidatePath("/dashboard");
  return { saved: true };
}

// Shared by uploadLogo/uploadCover/uploadBackground: validates the file,
// connects to storage (surfacing a specific, actionable message instead of a
// swallowed "Upload failed" if SUPABASE_SECRET_KEY is missing), ensures the
// bucket is actually public (a private bucket 404s every URL this app hands
// out), and returns the public URL rather than just writing it — the caller
// decides what field to persist it to.
async function uploadVenueImage(
  formData: FormData,
  restaurantId: string,
  kind: "logo" | "cover" | "bg",
): Promise<ImageUploadState> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No image received." };
  if (file.size > 4 * 1024 * 1024) return { error: "Image is too large." };
  if (!file.type.startsWith("image/")) return { error: "That isn't an image." };

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (e) {
    if (e instanceof StorageNotConfiguredError) return { error: e.message };
    return { error: "Couldn't reach image storage. Please try again." };
  }

  try {
    await ensurePublicBucket(supabase, MENU_IMAGE_BUCKET);
  } catch {
    return { error: "Couldn't prepare image storage. Please try again." };
  }

  const path = `${restaurantId}/${kind}-${randomBytes(6).toString("hex")}.jpg`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from(MENU_IMAGE_BUCKET)
    .upload(path, buffer, { contentType: "image/jpeg", upsert: true });
  if (upErr) return { error: `Upload failed: ${upErr.message}` };

  const { data: pub } = supabase.storage.from(MENU_IMAGE_BUCKET).getPublicUrl(path);
  return { url: pub.publicUrl };
}

export async function uploadLogo(formData: FormData): Promise<ImageUploadState> {
  const { authz, restaurant } = await currentRestaurant();
  if (!authz.can("settings:manage")) return { error: "Not permitted." };
  if (!restaurant) return { error: "Create your restaurant first." };

  const res = await uploadVenueImage(formData, restaurant.id, "logo");
  if (res.error) return res;

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { logoUrl: res.url },
  });
  revalidatePath("/dashboard/settings/branding");
  return res;
}

export async function removeLogo(): Promise<SettingsState> {
  const { authz, restaurant } = await currentRestaurant();
  if (!authz.can("settings:manage")) return { error: "Not permitted." };
  if (!restaurant) return { error: "Create your restaurant first." };

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { logoUrl: null },
  });
  revalidatePath("/dashboard/settings/branding");
  return { saved: true };
}

export async function uploadCover(formData: FormData): Promise<ImageUploadState> {
  const { authz, restaurant } = await currentRestaurant();
  if (!authz.can("settings:manage")) return { error: "Not permitted." };
  if (!restaurant) return { error: "Create your restaurant first." };

  const res = await uploadVenueImage(formData, restaurant.id, "cover");
  if (res.error) return res;

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { coverUrl: res.url },
  });
  revalidatePath("/dashboard/settings/branding");
  return res;
}

export async function removeCover(): Promise<SettingsState> {
  const { authz, restaurant } = await currentRestaurant();
  if (!authz.can("settings:manage")) return { error: "Not permitted." };
  if (!restaurant) return { error: "Create your restaurant first." };

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { coverUrl: null },
  });
  revalidatePath("/dashboard/settings/branding");
  return { saved: true };
}

export async function uploadBackground(
  formData: FormData,
): Promise<ImageUploadState> {
  const { authz, restaurant } = await currentRestaurant();
  if (!authz.can("settings:manage")) return { error: "Not permitted." };
  if (!restaurant) return { error: "Create your restaurant first." };

  const res = await uploadVenueImage(formData, restaurant.id, "bg");
  if (res.error) return res;

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { bgImageUrl: res.url },
  });
  revalidatePath("/dashboard/settings/branding");
  return res;
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
  revalidatePath("/dashboard/settings/branding");
  return { saved: true };
}
