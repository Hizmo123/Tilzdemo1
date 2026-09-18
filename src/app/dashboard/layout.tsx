import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthz } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { roleCan, type Permission } from "@/lib/rbac";
import { getEntitlements } from "@/lib/entitlements";
import { signOut } from "../(auth)/actions";
import { MobileNav } from "./mobile-nav";

// Each nav item declares the permission needed to see it. Overview and Bills are
// visible to every role (all roles have bills:view). This only hides controls —
// the actions themselves re-check permission server-side.
const nav: { label: string; href: string; perm: Permission | null }[] = [
  { label: "Overview", href: "/dashboard", perm: null },
  { label: "Tables", href: "/dashboard/tables", perm: "tables:manage" },
  { label: "Order Tillz stands", href: "/dashboard/stands", perm: "tables:manage" },
  { label: "Orders", href: "/dashboard/orders", perm: "kitchen:manage" },
  { label: "Kitchen screen", href: "/dashboard/kitchen", perm: "kitchen:manage" },
  { label: "Menu", href: "/dashboard/menu", perm: "menu:availability" },
  { label: "Bills", href: "/dashboard/bills", perm: "bills:view" },
  { label: "Invoices", href: "/dashboard/invoices", perm: "bills:view" },
  { label: "Analytics", href: "/dashboard/analytics", perm: "bills:view" },
  { label: "Team", href: "/dashboard/staff", perm: "staff:manage" },
  { label: "Staff logins", href: "/dashboard/staff-logins", perm: "staff:manage" },
  { label: "Activity", href: "/dashboard/activity", perm: "audit:view" },
  { label: "Billing", href: "/dashboard/billing", perm: "settings:manage" },
  { label: "Settings", href: "/dashboard/settings", perm: "settings:manage" },
  { label: "Security", href: "/dashboard/security", perm: null },
  { label: "Help", href: "/dashboard/help", perm: null },
  { label: "Support", href: "/support", perm: null },
];

// Which of the day-to-day items (Tables/Orders/Menu/Bills/Analytics) matter
// most for a given onboarding experienceMode. "Overview" always leads; the
// admin/config items (Team, Billing, Settings, ...) always stay put at the
// end — only the day-to-day ones get reprioritised. Everything stays a full
// click away either way; this only changes what's fastest to reach.
const EMPHASIS: Record<string, string[]> = {
  digital_menu: ["/dashboard/menu", "/dashboard/tables"],
  order_and_pay: ["/dashboard/orders", "/dashboard/tables", "/dashboard/menu", "/dashboard/bills"],
  payment_only: ["/dashboard/bills", "/dashboard/tables", "/dashboard/analytics"],
};

function reorderNav(
  items: typeof nav,
  experienceMode: string | null,
): typeof nav {
  const emphasis = experienceMode ? EMPHASIS[experienceMode] : undefined;
  if (!emphasis) return items;
  const rank = new Map(emphasis.map((href, i) => [href, i]));
  return [...items].sort((a, b) => {
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

  const visible = reorderNav(nav, restaurant?.experienceMode ?? null).filter(
    (item) => item.perm === null || (role && roleCan(role, item.perm)),
  );

  // Lapsed-subscription grace period (spec B4): a warning here, never a
  // lockout. Existing service, every dashboard page and read access all keep
  // working through the grace period regardless of what this shows —
  // nothing in this layout blocks rendering `children`.
  const entitlements = membership ? await getEntitlements(membership.organizationId) : null;

  return (
    <div className="min-h-dvh flex">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-line bg-surface sticky top-0 h-dvh">
        <div className="px-5 py-5 border-b border-line">
          <span className="font-display text-lg font-semibold tracking-tight">
            Tillz
          </span>
          <p className="text-xs text-muted mt-0.5 truncate">
            {restaurant?.name ?? "No restaurant yet"}
          </p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visible.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              prefetch={false}
              className="flex items-center rounded-lg px-3 py-2 text-sm text-ink hover:bg-paper transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-line px-5 py-4 pb-6 space-y-2">
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
          items={visible.map(({ label, href }) => ({ label, href }))}
          restaurantName={restaurant?.name ?? "No restaurant yet"}
          userEmail={user.email ?? ""}
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
  );
}
