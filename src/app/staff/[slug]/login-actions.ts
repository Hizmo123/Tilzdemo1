"use server";

import { prisma } from "@/lib/prisma";
import { staffLogin } from "@/lib/staff-auth";

export type LoginState = { error?: string; ok?: boolean };

// Verifies a staff PIN for a named account within a restaurant (by slug).
// Lockout and hashing are handled in staffLogin; this just resolves the slug and
// staff id, then delegates. Errors are deliberately generic.
export async function submitStaffLogin(
  slug: string,
  staffId: string,
  pin: string,
): Promise<LoginState> {
  if (!/^\d{4,6}$/.test(pin)) return { error: "Enter your PIN." };

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return { error: "Restaurant not found." };

  const result = await staffLogin(staffId, restaurant.id, pin);
  if (!result.ok) return { error: result.error };
  return { ok: true };
}
