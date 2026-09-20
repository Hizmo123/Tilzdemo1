import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { roleCan, type Permission } from "@/lib/rbac";
import { getEntitlements } from "@/lib/entitlements";

// Which restaurant is "active" for this browser — see setActiveVenue below.
// httpOnly: this is a server-only routing decision, never read/written from
// client JS. Not signed/scoped beyond ownership-checking on write
// (setActiveVenue) and re-validating on every read (getTenantContext) — a
// stale or tampered value just falls back to the org's first restaurant,
// it can never grant access to another org's data.
export const ACTIVE_VENUE_COOKIE = "tillz_active_venue";

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
// and every restaurant they belong to. Everything server-side scopes to
// this — never to an id sent from the browser. Cached per request:
// getAuthz(), getActiveLocation() and any page that also calls this
// directly all resolve to the same in-flight/resolved promise instead of
// re-querying Prisma.
//
// Active-venue selection (task E) lives HERE, not as a separate lookup:
// `restaurants[0]` is what getActiveLocation() and a large number of
// existing dashboard pages/actions already read directly (a pre-existing
// single-venue assumption, not something this task introduces) — reordering
// this ONE shared array so the cookie-selected restaurant is always first
// makes every one of those call sites respect the active venue with no
// changes of their own, which is the only way "every existing route keeps
// working unchanged" is actually true for this codebase. A cookie that
// doesn't match any restaurant in this org (unset, stale, or tampered) just
// leaves the default creation-order first restaurant in place.
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

  if (membership && membership.organization.restaurants.length > 1) {
    const jar = await cookies();
    const activeId = jar.get(ACTIVE_VENUE_COOKIE)?.value;
    if (activeId) {
      const restaurants = membership.organization.restaurants;
      const idx = restaurants.findIndex((r) => r.id === activeId);
      if (idx > 0) {
        membership.organization.restaurants = [
          restaurants[idx],
          ...restaurants.slice(0, idx),
          ...restaurants.slice(idx + 1),
        ];
      }
    }
  }

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

// Where to send someone right after they authenticate (task F). A brand new
// signup has no membership yet — /dashboard itself already redirects that
// case to /onboarding, so this only needs to special-case an EXISTING
// member: skip the picker entirely when there's nothing to pick between
// (0 or 1 restaurant), otherwise send them to /venues to choose.
export async function resolvePostLoginPath(): Promise<string> {
  const { membership } = await getTenantContext();
  if (!membership) return "/dashboard";
  return membership.organization.restaurants.length > 1 ? "/venues" : "/dashboard";
}

// HARD guard for every owner-side route that only makes sense when the org
// actually has live service to run — LITE (entitlements.ordering === false)
// is menu-only and must not be able to reach these by typing the URL
// directly, not just have the nav link hidden (see dashboard/layout.tsx's
// nav filtering, which is cosmetic only). Call at the very top of the
// Server Component for: dashboard/tables, dashboard/orders,
// dashboard/bills, dashboard/analytics, and the whole /staff/[slug] owner-
// operated area — never the customer-facing /v/[token] flow, which this
// deliberately does not touch.
export async function requireOrdering() {
  const { membership } = await getTenantContext();
  if (!membership) return; // no org yet — onboarding/dashboard handles this case
  const ent = await getEntitlements(membership.organizationId);
  if (!ent.ordering) redirect("/dashboard");
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
