"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTenantContext, ACTIVE_VENUE_COOKIE } from "@/lib/auth";

// Switches which of the org's restaurants subsequent requests treat as
// "active" — see lib/auth.ts#getTenantContext for how the cookie is
// actually applied (reordering the shared restaurants array so every
// existing `restaurants[0]` read respects it, no per-page changes needed).
export async function setActiveVenue(restaurantId: string) {
  const { membership } = await getTenantContext();
  if (!membership) redirect("/onboarding");

  // Ownership check: the id must be one of THIS org's restaurants, or a
  // signed-in user could point their own session at another org's venue by
  // guessing/tampering with the cookie value.
  const belongs = membership.organization.restaurants.some((r) => r.id === restaurantId);
  if (!belongs) redirect("/venues");

  const jar = await cookies();
  jar.set(ACTIVE_VENUE_COOKIE, restaurantId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // No maxAge/expires — a session cookie. Switching venues is a per-visit
    // choice, not something that should quietly stick around for months
    // after the browser closes.
  });

  redirect("/dashboard");
}
