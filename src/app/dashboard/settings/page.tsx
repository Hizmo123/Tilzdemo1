import Link from "next/link";
import { getAuthz } from "@/lib/auth";
import { roleCan, type Permission } from "@/lib/rbac";

const CARDS: {
  href: string;
  label: string;
  description: string;
  // null = every signed-in role sees this card (matches that page's own,
  // separate permission check — see Security below, which only requires
  // being signed in, not settings:manage). Every other card requires
  // settings:manage, same as before this became a per-card check.
  perm: Permission | null;
}[] = [
  {
    href: "/dashboard/settings/venue",
    label: "Venue details",
    description: "Name, ABN verification, contact phone, timezone and currency.",
    perm: "settings:manage",
  },
  {
    href: "/dashboard/settings/branding",
    label: "Customisation & branding",
    description: "Theme, colours, fonts, corner style, logo, banner and background.",
    perm: "settings:manage",
  },
  {
    href: "/dashboard/settings/service",
    label: "Service model",
    description: "Ordering, payment timing, surcharge, tipping and POS.",
    perm: "settings:manage",
  },
  {
    href: "/dashboard/settings/hours",
    label: "Opening hours",
    description: "When ordering is open, in your venue's local time.",
    perm: "settings:manage",
  },
  {
    href: "/dashboard/settings/notifications",
    label: "Notifications",
    description: "Kitchen chime.",
    perm: "settings:manage",
  },
  {
    href: "/dashboard/settings/security",
    label: "Security",
    description: "Two-factor authentication and passkeys.",
    perm: null,
  },
  {
    href: "/dashboard/billing",
    label: "Billing",
    description: "Your Tillz plan and payment method.",
    perm: "settings:manage",
  },
  {
    href: "/dashboard/settings/privacy",
    label: "Privacy & data",
    description: "Export your data, or request account deletion.",
    perm: "settings:manage",
  },
];

export default async function SettingsPage() {
  const authz = await getAuthz();
  const restaurant = authz.membership?.organization.restaurants[0];

  if (!restaurant) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Settings
        </h1>
        <p className="text-muted">
          Create your restaurant first from the{" "}
          <Link href="/dashboard" className="text-pine hover:underline">
            Overview
          </Link>{" "}
          page.
        </p>
      </div>
    );
  }

  // No longer an all-or-nothing gate: most cards need settings:manage, but
  // Security (perm: null) is a personal-account feature — every signed-in
  // role could already reach it directly before this page folded it in, so
  // it must stay visible here too, even to a role that can't touch the rest
  // of these settings.
  const visibleCards = CARDS.filter(
    (c) => c.perm === null || (authz.role && roleCan(authz.role, c.perm)),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Settings
        </h1>
        <p className="text-muted mt-1">{restaurant.name}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {visibleCards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="flex items-start gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 hover:border-pine/40 hover:bg-paper transition-colors"
          >
            <span className="min-w-0">
              <span className="block font-medium">{c.label}</span>
              <span className="block text-sm text-muted mt-0.5">{c.description}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
