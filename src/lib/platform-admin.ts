import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Platform-admin (super-admin) gate for /admin — an interface that reads
// ACROSS every organisation, bypassing the normal tenant boundary. Get this
// wrong and every venue's data leaks, so it's deliberately belt-and-braces:
//
//  - The ONLY source of admin truth is PLATFORM_ADMIN_USER_IDS, an env var —
//    never a DB flag, never anything a client could set or an app bug could
//    flip. Nothing in the schema marks a Membership/Organization/user as
//    "admin"; there is no escalation path through the product.
//  - This module NEVER calls getTenantContext/getActiveLocation/getAuthz —
//    admin is not tenant-scoped, and importing those would risk this file
//    accidentally depending on (or being confused with) per-org state.
//  - requirePlatformAdmin() must be called at the top of the /admin layout
//    AND at the top of every individual /admin server action — the layout
//    alone is not the real gate (a server action can be invoked directly,
//    bypassing whatever a layout rendered). src/middleware.ts adds a second,
//    independent wall in front of both.

function allowlist(): Set<string> {
  const raw = process.env.PLATFORM_ADMIN_USER_IDS ?? "";
  return new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  );
}

// True/false only — for conditional UI (e.g. showing an "Admin" link to a
// signed-in user who happens to be one). Never treat this as the security
// boundary on its own; it doesn't redirect, so a caller that only checks this
// and still renders admin content/data is NOT gated. Use requirePlatformAdmin
// for that.
export async function isPlatformAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  return allowlist().has(user.id);
}

// The real gate. Redirects to /dashboard — never a 403/404 that would confirm
// /admin exists — for anyone not on the allowlist, including a signed-out
// visitor. Call this first, before any cross-tenant read, in every /admin
// page/layout and every /admin server action.
export async function requirePlatformAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !allowlist().has(user.id)) {
    redirect("/dashboard");
  }

  return { userId: user.id };
}
