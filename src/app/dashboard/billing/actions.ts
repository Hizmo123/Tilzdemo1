"use server";

import { revalidatePath } from "next/cache";
import type { PlanTier } from "@prisma/client";
import { getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { planByTier } from "@/lib/plans";

export type BillingState = { error?: string; ok?: boolean };

// MOCK subscription checkout. No real charge — this validates a test card
// (use 4242 4242 4242 4242) and records the chosen plan on the organization.
// Real Stripe Billing replaces this later behind the same call.
export async function subscribe(
  tier: PlanTier,
  card: { number: string; exp: string; cvc: string },
): Promise<BillingState> {
  const authz = await getAuthz();
  if (!authz.can("settings:manage"))
    return { error: "Only an owner or admin can manage billing." };
  const org = authz.membership?.organization;
  if (!org) return { error: "Create your restaurant first." };

  const plan = planByTier(tier);

  // Free plan needs no payment.
  if (plan.priceCents === 0) {
    await prisma.organization.update({
      where: { id: org.id },
      data: { plan: "LITE", planStatus: "active", cardLast4: null, subscribedAt: new Date() },
    });
    revalidatePath("/dashboard/billing");
    revalidatePath("/dashboard");
    return { ok: true };
  }

  // Validate the (mock) card.
  const digits = card.number.replace(/\s+/g, "");
  if (!/^\d{13,19}$/.test(digits)) return { error: "Enter a valid card number." };
  if (!/^\d{2}\s*\/\s*\d{2}$/.test(card.exp)) return { error: "Expiry must be MM/YY." };
  const [mm, yy] = card.exp.split("/").map((x) => parseInt(x.trim(), 10));
  if (mm < 1 || mm > 12) return { error: "Expiry month is invalid." };
  const now = new Date();
  const expiryEnd = new Date(2000 + yy, mm, 1);
  if (expiryEnd <= now) return { error: "That card has expired." };
  if (!/^\d{3,4}$/.test(card.cvc)) return { error: "CVC must be 3–4 digits." };

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      plan: tier,
      planStatus: "active",
      cardLast4: digits.slice(-4),
      subscribedAt: new Date(),
    },
  });

  await audit({
    organizationId: org.id,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "billing.subscribed",
    metadata: { plan: tier },
  });

  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function cancelSubscription(): Promise<BillingState> {
  const authz = await getAuthz();
  if (!authz.can("settings:manage")) return { error: "Not permitted." };
  const org = authz.membership?.organization;
  if (!org) return { error: "Not found." };

  await prisma.organization.update({
    where: { id: org.id },
    data: { plan: "LITE", planStatus: "canceled", cardLast4: null },
  });

  await audit({
    organizationId: org.id,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "billing.canceled",
  });

  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard");
  return { ok: true };
}
