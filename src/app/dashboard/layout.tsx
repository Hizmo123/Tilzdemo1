import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthz } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { roleCan, type Permission } from "@/lib/rbac";
import type { Role } from "@prisma/client";
import { getEntitlements } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { signOut } from "../(auth)/actions";
import { MobileNav } from "./mobile-nav";
import { NavSections } from "./nav-sections";
import { TourProvider } from "@/components/tour/tour-provider";
import { markDashboardTourComplete } from "./tour-actions";

// Each nav item declares the permission needed to see it. Overview and Bills are
// visible to every role (all roles have bills:view). This only hides controls —
// the actions themselves re-check permission server-side.
type NavEntry = { label: string; href: string; perm: Permission | null };
type NavSection = { label: string; items: NavEntry[] };

const navSections: NavSection[] = [
  {
    label: "Operations",
    items: [
      { label: "Overview", href: "/dashboard", perm: null },
      { label: "Orders", href: "/dashboard/orders", perm: "kitchen:manage" },
      { label: "Tables", href: "/dashboard/tables", perm: "tables:manage" },
      { label: "Kitchen screen", href: "/dashboard/kitchen", perm: "kitchen:manage" },
    ],
  },
  {
    label: "Menu & hardware",
    items: [
      { label: "Menu", href: "/dashboard/menu", perm: "menu:availability" },
      { label: "Order Tillz stands", href: "/dashboard/stands", perm: "tables:manage" },
    ],
  },
  {
    label: "Money",
    items: [
      { label: "Bills", href: "/dashboard/bills", perm: "bills:view" },
      { label: "Invoices", href: "/dashboard/invoices", perm: "bills:view" },
      { label: "Analytics", href: "/dashboard/analytics", perm: "bills:view" },
    ],
  },
  {
    label: "Team",
    items: [
      { label: "Team", href: "/dashboard/staff", perm: "staff:manage" },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Billing", href: "/dashboard/billing", perm: "settings:manage" },
      // null, not "settings:manage": Settings now folds in Security (2FA/
      // passkeys), which every signed-in role could always reach directly
      // before (see settings/page.tsx's own per-card permission filter,
      // separate from this nav-level check) — gating the nav item itself
      // to settings:manage would remove their only nav path to it, even
      // though the page underneath would still show them that one card.
      { label: "Settings", href: "/dashboard/settings", perm: null },
    ],
  },
];

// Which of the day-to-day items (Tables/Orders/Menu/Bills/Analytics) matter
// most for a given onboarding experienceMode. "Overview" always leads; the
// admin/config items (Team, Billing, Settings, ...) always stay put at the
// end — only the day-to-day ones get reprioritised.
//
// Reordering is applied WITHIN each section, never across sections — the
// fixed section order (Operations / Menu & hardware / Money / Team / Account)
// takes precedence over emphasis. Previously (flat-list days) emphasis could
// pull an item like Bills all the way to the top of the ENTIRE nav, ahead of
// un-emphasized items from other groups — that specific cross-group jump is
// no longer possible once items are grouped under fixed section headers, so
// this only reorders items relative to their section-mates now. Everything
// stays a full click away either way; this only changes what's fastest to
// reach within its own group.
const EMPHASIS: Record<string, string[]> = {
  digital_menu: ["/dashboard/menu", "/dashboard/tables"],
  order_and_pay: ["/dashboard/orders", "/dashboard/tables", "/dashboard/menu", "/dashboard/bills"],
  payment_only: ["/dashboard/bills", "/dashboard/tables", "/dashboard/analytics"],
};

function reorderSection(
  items: NavEntry[],
  rank: Map<string, number> | null,
): NavEntry[] {
  if (!rank) return items;
  return [...items].sort((a, b) => {
    // Overview is pinned first regardless of emphasis — it's never in an
    // EMPHASIS list (there's nothing to "emphasise" it over), so without
    // this it was the one unranked item a ranked one (e.g. Tables, under
    // digital_menu) could sort ahead of. Always-first, not just usually.
    if (a.href === "/dashboard") return -1;
    if (b.href === "/dashboard") return 1;
    const ra = rank.get(a.href);
    const rb = rank.get(b.href);
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    return 0; // keep original relative order for everything else
  });
}

// On LITE (entitlements.ordering === false) the org gets ONLY these — Menu
// and Settings/Billing to run the venue's info and plan, nothing tied to
// live service (Tables/Orders/Kitchen/Bills/Analytics/Team), since there is
// no live service to run. This is nav-level hiding only; the actual security
// boundary is requireOrdering()'s hard redirect on each of those routes
// (see lib/auth.ts) — a Lite user typing the URL directly must still be
// bounced back, not just kept from seeing the link.
const ORDERING_FREE_HREFS = new Set(["/dashboard", "/dashboard/menu", "/dashboard/billing", "/dashboard/settings"]);

// Connect-tier orgs: Square owns the kitchen, not Tillz — the "Kitchen
// screen" nav item (device setup instructions + QR for Tillz's own kitchen
// terminal) is a dead end on this tier, same nav-hiding-only pattern as
// ORDERING_FREE_HREFS above. The real boundary is dashboard/kitchen's own
// layout.tsx redirect — a Connect user typing the URL directly must still
// be bounced back, not just kept from seeing the link.
const CONNECT_HIDDEN_HREFS = new Set(["/dashboard/kitchen"]);

function buildVisibleSections(
  experienceMode: string | null,
  role: Role | null,
  ordering: boolean,
  squareOwnsKitchen: boolean,
): NavSection[] {
  const emphasis = experienceMode ? EMPHASIS[experienceMode] : undefined;
  const rank = emphasis ? new Map(emphasis.map((href, i) => [href, i])) : null;

  return navSections
    .map((section) => ({
      label: section.label,
      items: reorderSection(section.items, rank).filter(
        (item) =>
          (item.perm === null || (role && roleCan(role, item.perm))) &&
          (ordering || ORDERING_FREE_HREFS.has(item.href)) &&
          !(squareOwnsKitchen && CONNECT_HIDDEN_HREFS.has(item.href)),
      ),
    }))
    .filter((section) => section.items.length > 0);
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // getAuthz() and the MFA check are two independent Supabase Auth network
  // round trips (neither depends on the other's result) — every dashboard
  // page load used to pay for them back-to-back. Running them together cuts
  // one full round trip off every page under /dashboard.
  const [{ user, membership, role }, aal] = await Promise.all([
    getAuthz(),
    createClient().then((supabase) => supabase.auth.mfa.getAuthenticatorAssuranceLevel()),
  ]);

  // Two-factor step-up: if this account has an enrolled second factor but the
  // session is only at AAL1, send them to complete it. Accounts WITHOUT 2FA
  // have nextLevel === "aal1", so this never affects them — login is unchanged.
  if (aal.data?.currentLevel === "aal1" && aal.data?.nextLevel === "aal2") {
    redirect("/mfa");
  }

  // A deactivated org blocks the whole team's dashboard access (see
  // lib/account.ts#deactivateAccount) — the only way back in is the emailed
  // reactivation link, never from inside here, since this IS "inside here".
  if (membership?.organization.deactivatedAt) {
    return (
      <main className="min-h-dvh bg-paper flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Account deactivated
          </h1>
          <p className="text-muted text-sm mt-2">
            This account was deactivated and its subscription cancelled.
            Check the owner&apos;s inbox for a reactivation link.
          </p>
          <form action={signOut} className="mt-6">
            <button
              type="submit"
              className="text-sm text-ink-soft hover:text-danger underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </main>
    );
  }

  const restaurant = membership?.organization.restaurants[0];

  // Lapsed-subscription grace period (spec B4): a warning here, never a
  // lockout. Existing service, every dashboard page and read access all keep
  // working through the grace period regardless of what this shows —
  // nothing in this layout blocks rendering `children`. Also drives the nav
  // filtering below (LITE hides everything tied to live service).
  const entitlements = membership ? await getEntitlements(membership.organizationId) : null;

  const visibleSections = buildVisibleSections(
    restaurant?.experienceMode ?? null,
    role,
    entitlements?.ordering ?? true,
    entitlements?.requiresSquare ?? false,
  );

  // Square catalog link — only when this venue actually has a connection
  // (not gated on entitlements.ordering; a connected Square account is
  // independent of the plan tier). Inserted after buildVisibleSections
  // rather than declared statically in navSections since it depends on a
  // per-request DB check, unlike every other (permission-only) nav item.
  if (restaurant) {
    const squareConnection = await prisma.squareConnection.findUnique({
      where: { restaurantId: restaurant.id },
      select: { id: true },
    });
    if (squareConnection && (!role || roleCan(role, "menu:availability"))) {
      const menuSection = visibleSections.find((s) => s.label === "Menu & hardware");
      if (menuSection) {
        menuSection.items.push({ label: "Square catalog", href: "/dashboard/menu/square", perm: null });
      }
    }
  }

  // Cross-venue overview (entitlements.crossVenueList) — same "depends on a
  // per-request DB check, not just a permission" reasoning as Square catalog
  // above. Visible only when the org's own venue capacity allows more than
  // one venue (PRO, or CONNECT with a matching venueLimit) — same gate the
  // route itself enforces server-side (dashboard/venues-overview/page.tsx).
  if (entitlements?.crossVenueList && (!role || roleCan(role, "bills:view"))) {
    const moneySection = visibleSections.find((s) => s.label === "Money");
    if (moneySection) {
      moneySection.items.push({ label: "Venues", href: "/dashboard/venues-overview", perm: null });
    }
  }

  return (
    // The guided tour lives at layout level so it survives every route
    // change under /dashboard (its steps span Overview, Menu, Tables and
    // Settings). The overlay itself is a portal; this only holds state.
    // Auto-starts once, on the first Overview visit after the wizard, for
    // someone who can actually act on every step (settings:manage covers
    // the Integrations step); completion/skip is recorded server-side so it
    // never auto-starts again. Replay is always available regardless.
    <TourProvider
      ordering={entitlements?.ordering ?? true}
      autoStart={
        !!restaurant?.onboardingCompletedAt &&
        !restaurant?.dashboardTourCompletedAt &&
        !!role &&
        roleCan(role, "settings:manage")
      }
      onFinished={markDashboardTourComplete}
    >
    <div className="min-h-dvh flex">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-line bg-surface sticky top-0 h-dvh">
        <div className="px-5 py-5 border-b border-line">
          <span className="font-display text-lg font-semibold tracking-tight">
            Tillz
          </span>
          <p className="text-xs text-muted mt-0.5 truncate">
            {restaurant?.name ?? "No restaurant yet"}
          </p>
          {(membership?.organization.restaurants.length ?? 0) > 1 && (
            <Link
              href="/venues"
              prefetch={false}
              className="text-xs text-pine hover:underline mt-0.5 inline-block"
            >
              Switch venue
            </Link>
          )}
        </div>

        <NavSections
          sections={visibleSections.map((section) => ({
            label: section.label,
            items: section.items.map(({ label, href }) => ({ label, href })),
          }))}
        />

        <div className="border-t border-line px-5 py-4 pb-6 space-y-2">
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/dashboard/help"
              prefetch={false}
              className="text-ink-soft hover:text-ink transition-colors"
            >
              Help
            </Link>
            <Link
              href="/support"
              prefetch={false}
              className="text-ink-soft hover:text-ink transition-colors"
            >
              Support
            </Link>
          </div>
          <p className="text-xs text-muted truncate">{user.email}</p>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-ink-soft hover:text-danger transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <MobileNav
          sections={visibleSections.map((section) => ({
            label: section.label,
            items: section.items.map(({ label, href }) => ({ label, href })),
          }))}
          restaurantName={restaurant?.name ?? "No restaurant yet"}
          userEmail={user.email ?? ""}
          showVenueSwitcher={(membership?.organization.restaurants.length ?? 0) > 1}
        />
        {entitlements?.lapsed && (
          <div
            className={`px-4 py-2.5 sm:px-8 text-sm text-center ${
              entitlements.orderingBlocked
                ? "bg-danger text-white"
                : "bg-amber-500 text-white"
            }`}
          >
            {entitlements.orderingBlocked
              ? "New ordering is paused — your last payment failed. Everything else keeps working. "
              : `Payment failed — you have until ${entitlements.graceEndsAt?.toLocaleDateString("en-AU")} before new ordering pauses. `}
            <Link href="/dashboard/billing" className="underline font-medium">
              Update payment method
            </Link>
          </div>
        )}
        <main className="px-4 py-6 sm:px-8 sm:py-8 max-w-5xl">{children}</main>
      </div>
    </div>
    </TourProvider>
  );
}
