import Link from "next/link";
import { getAuthz } from "@/lib/auth";

const CARDS: {
  href: string;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    href: "/dashboard/settings/venue",
    label: "Venue details",
    description: "Name, ABN verification, contact phone, timezone and currency.",
    icon: "🏠",
  },
  {
    href: "/dashboard/settings/branding",
    label: "Customisation & branding",
    description: "Theme, colours, fonts, corner style, logo, banner and background.",
    icon: "🎨",
  },
  {
    href: "/dashboard/settings/service",
    label: "Service model",
    description: "Ordering, payment timing, surcharge, tipping and POS.",
    icon: "🛎️",
  },
  {
    href: "/dashboard/settings/hours",
    label: "Opening hours",
    description: "When ordering is open, in your venue's local time.",
    icon: "🕐",
  },
  {
    href: "/dashboard/settings/notifications",
    label: "Notifications",
    description: "Kitchen chime and order-ready texts.",
    icon: "🔔",
  },
  {
    href: "/dashboard/billing",
    label: "Billing",
    description: "Your Tillz plan and payment method.",
    icon: "💳",
  },
  {
    href: "/dashboard/settings/privacy",
    label: "Privacy & data",
    description: "Export your data, or request account deletion.",
    icon: "🔒",
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

  if (!authz.can("settings:manage")) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Settings
        </h1>
        <p className="text-muted">You don&apos;t have permission to change settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Settings
        </h1>
        <p className="text-muted mt-1">{restaurant.name}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="flex items-start gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 hover:border-pine/40 hover:bg-paper transition-colors"
          >
            <span className="text-2xl shrink-0" aria-hidden>
              {c.icon}
            </span>
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
