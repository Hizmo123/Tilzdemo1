import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthz } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { roleCan, type Permission } from "@/lib/rbac";
import { signOut } from "../(auth)/actions";
import { MobileNav } from "./mobile-nav";

// Each nav item declares the permission needed to see it. Overview and Bills are
// visible to every role (all roles have bills:view). This only hides controls —
// the actions themselves re-check permission server-side.
const nav: { label: string; href: string; perm: Permission | null }[] = [
  { label: "Overview", href: "/dashboard", perm: null },
  { label: "Tables", href: "/dashboard/tables", perm: "tables:manage" },
  { label: "Orders", href: "/dashboard/orders", perm: "kitchen:manage" },
  { label: "Menu", href: "/dashboard/menu", perm: "menu:availability" },
  { label: "Bills", href: "/dashboard/bills", perm: "bills:view" },
  { label: "Analytics", href: "/dashboard/analytics", perm: "bills:view" },
  { label: "Team", href: "/dashboard/staff", perm: "staff:manage" },
  { label: "Staff logins", href: "/dashboard/staff-logins", perm: "staff:manage" },
  { label: "Activity", href: "/dashboard/activity", perm: "audit:view" },
  { label: "Billing", href: "/dashboard/billing", perm: "settings:manage" },
  { label: "Settings", href: "/dashboard/settings", perm: "settings:manage" },
  { label: "Security", href: "/dashboard/security", perm: null },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, membership, role } = await getAuthz();

  // Two-factor step-up: if this account has an enrolled second factor but the
  // session is only at AAL1, send them to complete it. Accounts WITHOUT 2FA
  // have nextLevel === "aal1", so this never affects them — login is unchanged.
  const supabase = await createClient();
  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
    redirect("/mfa");
  }

  const restaurant = membership?.organization.restaurants[0];

  const visible = nav.filter(
    (item) => item.perm === null || (role && roleCan(role, item.perm)),
  );

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
        <main className="px-4 py-6 sm:px-8 sm:py-8 max-w-5xl">{children}</main>
      </div>
    </div>
  );
}
