import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { roleCan, type Permission } from "@/lib/rbac";

// Returns the current Supabase user or null. Uses getUser() (not getSession())
// so the token is verified against Supabase — a real network round trip, not
// just a local cookie read. Wrapped in React's cache() so the many call sites
// that independently need the user (the dashboard layout, a page, and that
// page's own permission check) share ONE verification per request instead of
// each paying for their own — a page under /dashboard used to trigger this
// two or three times over before rendering anything.
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// Use in Server Components / actions that require a signed-in user.
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

// The tenant context for the signed-in user: their membership, organization,
// and (for M1) the first restaurant. Everything server-side scopes to this —
// never to an id sent from the browser. Cached per request: getAuthz(),
// getActiveLocation() and any page that also calls this directly all resolve
// to the same in-flight/resolved promise instead of re-querying Prisma.
export const getTenantContext = cache(async () => {
  const user = await requireUser();

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: {
      organization: {
        include: {
          restaurants: {
            orderBy: { createdAt: "asc" },
            include: {
              locations: { orderBy: { createdAt: "asc" } },
            },
          },
        },
      },
    },
  });

  return { user, membership };
});

// Authorization context: the signed-in user's role plus a `can()` check against
// the permission matrix. Used by server actions to gate mutations, and by the
// dashboard layout to hide controls a role can't use.
export async function getAuthz() {
  const { user, membership } = await getTenantContext();
  const role = membership?.role ?? null;
  return {
    user,
    membership,
    role,
    can: (permission: Permission) => (role ? roleCan(role, permission) : false),
  };
}

// Resolves the signed-in user's active restaurant + first location. Until
// multi-location lands, this is the single working location. Returns null when
// the user hasn't created a restaurant yet (first-run onboarding).
export async function getActiveLocation() {
  const { user, membership } = await getTenantContext();
  const restaurant = membership?.organization.restaurants[0] ?? null;
  const location = restaurant?.locations[0] ?? null;
  if (!restaurant || !location) return null;
  return { user, membership: membership!, restaurant, location };
}

// Same as getActiveLocation but redirects to the dashboard onboarding when no
// restaurant/location exists yet. Use in pages/actions that require one.
export async function requireActiveLocation() {
  const ctx = await getActiveLocation();
  if (!ctx) redirect("/dashboard");
  return ctx;
}

// Tenant-isolation guard for table-scoped operations. Loads a table ONLY if it
// belongs to a location -> restaurant -> organization the user is a member of.
// Returns the table (with location + restaurant) or null. Never trust a tableId
// from the client without passing it through here first (spec §100, §101).
export async function getOwnedTable(userId: string, tableId: string) {
  return prisma.table.findFirst({
    where: {
      id: tableId,
      location: {
        restaurant: {
          organization: { memberships: { some: { userId } } },
        },
      },
    },
    include: {
      location: { include: { restaurant: true } },
    },
  });
}
