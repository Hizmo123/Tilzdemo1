"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  VENUE_TYPES,
  SPLIT_METHOD_VALUES,
  isFullyStaffedMode,
} from "@/lib/onboarding-options";

export type VenueSetupState =
  | { error?: string; saved?: boolean }
  // Save is held pending an explicit choice: this venue has existing
  // printed table QR codes and is switching INTO fully-staffed mode (see
  // isFullyStaffedMode) — nothing is written yet. Re-call with
  // tableQrChoice set once the owner picks.
  | { needsTableQrChoice: true; tableCount: number };

const schema = z.object({
  venueType: z.enum(VENUE_TYPES.map((v) => v.value) as [string, ...string[]]),
  experienceMode: z.string().min(1).max(40),
  customerOrdering: z.boolean(),
  customerPayment: z.boolean(),
  paymentTiming: z.enum(["before", "after"]),
  staffApproval: z.boolean(),
  splitMethods: z.array(z.enum(SPLIT_METHOD_VALUES)).min(1),
  // Set only on the re-submit after the owner has answered the prompt above.
  // "shared" switches this venue onto the one venue-wide QR (same mechanism
  // Lite uses); "keep" leaves existing Table/QrToken rows exactly as they
  // are — this flow never deletes them either way, it only decides what the
  // dashboard leads with.
  tableQrChoice: z.enum(["shared", "keep"]).optional(),
});

// Revisits the onboarding-only questions (venue type, experience mode + its
// toggles, split methods) from Settings, reusing the exact same picker
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

  const wasFullyStaffed = isFullyStaffedMode(restaurant.customerOrdering, restaurant.customerPayment);
  const willBeFullyStaffed = isFullyStaffedMode(a.customerOrdering, a.customerPayment);

  // Transitioning INTO fully-staffed mode: check whether this venue has
  // printed per-table QR codes it could otherwise silently lose the
  // visibility of. No tables = nothing to choose between, same as a fresh
  // onboarding — proceed straight to "shared".
  let useSharedQr = restaurant.useSharedQr;
  if (willBeFullyStaffed && !wasFullyStaffed) {
    if (!a.tableQrChoice) {
      const tableCount = await prisma.table.count({
        where: { location: { restaurantId: restaurant.id } },
      });
      if (tableCount > 0) {
        return { needsTableQrChoice: true, tableCount };
      }
      useSharedQr = true;
    } else {
      useSharedQr = a.tableQrChoice === "shared";
    }
  } else if (!willBeFullyStaffed) {
    // Leaving fully-staffed mode (or never was in it): per-table
    // creation/management is simply available again — see
    // isFullyStaffedMode's callers on the Tables page and Overview, which
    // gate on the mode itself, not this flag. Reset it so a LATER return to
    // fully-staffed mode asks fresh rather than silently reapplying a stale
    // choice from a previous, unrelated switch.
    useSharedQr = false;
  }

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
      useSharedQr,
    },
  });

  revalidatePath("/dashboard/settings/service");
  revalidatePath("/dashboard/tables");
  revalidatePath("/dashboard");
  return { saved: true };
}
