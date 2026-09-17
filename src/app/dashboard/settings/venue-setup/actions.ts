"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  VENUE_TYPES,
  SPLIT_METHOD_VALUES,
} from "@/lib/onboarding-options";

export type VenueSetupState = { error?: string; saved?: boolean };

const schema = z.object({
  venueType: z.enum(VENUE_TYPES.map((v) => v.value) as [string, ...string[]]),
  experienceMode: z.string().min(1).max(40),
  customerOrdering: z.boolean(),
  customerPayment: z.boolean(),
  paymentTiming: z.enum(["before", "after"]),
  staffApproval: z.boolean(),
  splitMethods: z.array(z.enum(SPLIT_METHOD_VALUES)).min(1),
  posProvider: z.enum(["square", "none"]).nullable(),
  posProviderOther: z.string().trim().max(60).optional().or(z.literal("")),
  squareConnectInterest: z.boolean(),
});

// Revisits the onboarding-only questions (venue type, experience mode + its
// toggles, split methods, POS) from Settings, reusing the exact same picker
// components the wizard uses.
export async function updateVenueSetup(
  input: z.infer<typeof schema>,
): Promise<VenueSetupState> {
  const authz = await getAuthz();
  if (!authz.can("settings:manage")) {
    return { error: "You don't have permission to change this." };
  }
  const restaurant = authz.membership?.organization.restaurants[0];
  if (!restaurant) return { error: "Create your restaurant first." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const a = parsed.data;

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: {
      venueType: a.venueType,
      experienceMode: a.experienceMode,
      customerOrdering: a.customerOrdering,
      customerPayment: a.customerPayment,
      paymentTiming: a.paymentTiming,
      staffApproval: a.staffApproval,
      splitMethods: a.splitMethods,
      posProvider: a.posProvider,
      posProviderOther: a.posProviderOther ? a.posProviderOther : null,
      squareConnectInterest: a.squareConnectInterest,
    },
  });

  revalidatePath("/dashboard/settings/service");
  revalidatePath("/dashboard");
  return { saved: true };
}
