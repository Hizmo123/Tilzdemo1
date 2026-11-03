"use server";

import { rateLimit, isRateLimited, clientIp } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { staffLogin } from "@/lib/staff-auth";

export type LoginState = { error?: string; ok?: boolean; redirectTo?: string };

// Verifies a staff PIN for a named account within a restaurant (by slug).
// Lockout and hashing are handled in staffLogin; this just resolves the slug and
// staff id, then delegates. Errors are deliberately generic.
export async function submitStaffLogin(
  slug: string,
  staffId: string,
  pin: string,
): Promise<LoginState> {
  if (!/^\d{4,6}$/.test(pin)) return { error: "Enter your PIN." };
  if (typeof slug !== "string" || slug.length > 100 || typeof staffId !== "string" || staffId.length > 64)
    return { error: "Restaurant not found." };

  // Per venue + IP: 5 failed PINs locks that IP out of this venue for 15 min
  // (the per-account lockout in staffLogin covers distributed guessing).
  const lockKey = `pin-fail:${slug}:${clientIp(await headers())}`;
  const FAIL_WINDOW = 15 * 60_000;

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    include: { organization: { select: { deactivatedAt: true } } },
  });
  if (!restaurant) return { error: "Restaurant not found." };
  // A deactivated org blocks every restaurant under it, same as the owner's
  // own dashboard login — deactivatedAt is set by platform-admin suspension
  // (lib/admin/account-actions.ts).
  if (restaurant.organization.deactivatedAt) {
    return { error: "This venue's account is currently deactivated." };
  }

  if (await isRateLimited(lockKey, 5)) return { error: "Too many attempts. Try again in a few minutes." };

  const result = await staffLogin(staffId, restaurant.id, pin);
  if (!result.ok) {
    await rateLimit(lockKey, 5, FAIL_WINDOW); // record one failure
    return { error: result.error };
  }

  // A station-locked kitchen account has no real use for the floor/home
  // screen — send it straight to its own board, station pre-selected.
  const redirectTo =
    result.role === "KITCHEN" && result.assignedStation
      ? `/staff/${slug}/kitchen?station=${encodeURIComponent(result.assignedStation)}`
      : `/staff/${slug}/home`;
  return { ok: true, redirectTo };
}
