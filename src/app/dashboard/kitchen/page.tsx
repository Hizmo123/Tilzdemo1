import Link from "next/link";
import { getAuthz } from "@/lib/auth";
import { appBaseUrl } from "@/lib/urls";
import { qrDataUrlForUrl } from "@/lib/qr";

const CHECKLIST = [
  "Any tablet 10\" or larger — a phone works for testing, but is too small for a busy pass.",
  "A stand or wall mount that keeps it visible and hands-free.",
  "Power at the pass — this runs all shift, so don't rely on battery alone.",
  "Wifi signal actually reaches the kitchen (walk over and check, don't assume from the office).",
  "Turn off screen sleep / auto-lock in the device's display settings — the kitchen screen requests a wake lock automatically, but not every device honours it.",
  "Open the screen and tap \"Enable sound\" once so ticket chimes work all service.",
  "Tap \"Fullscreen\" on the kitchen screen so a stray swipe can't navigate away.",
];

export default async function KitchenSetupPage() {
  const authz = await getAuthz();
  const restaurant = authz.membership?.organization.restaurants[0];

  if (!restaurant) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Kitchen screen
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

  if (!authz.can("kitchen:manage")) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Kitchen screen
        </h1>
        <p className="text-muted">You don&apos;t have permission to view this.</p>
      </div>
    );
  }

  const kitchenUrl = `${appBaseUrl()}/staff/${restaurant.slug}/kitchen`;
  const qrPreview = await qrDataUrlForUrl(kitchenUrl);

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Kitchen screen
        </h1>
        <p className="text-muted mt-1">
          Everything needed to stand up a tablet at the pass.
        </p>
      </div>

      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight mb-1">
          Open the kitchen screen
        </h2>
        <p className="text-sm text-muted mb-4">
          Scan this on the tablet, or open the link directly. It signs in with
          a staff PIN the first time, then stays signed in for 12 hours.
        </p>
        <div className="grid sm:grid-cols-[auto_1fr] gap-5 items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrPreview}
            alt="QR code for the kitchen screen"
            className="w-32 h-32 rounded-lg border border-line shrink-0"
            width={128}
            height={128}
          />
          <div className="space-y-3 min-w-0">
            <code className="block text-xs break-all bg-paper rounded px-2 py-1.5">
              {kitchenUrl}
            </code>
            <div className="flex flex-wrap gap-2">
              <a
                href={kitchenUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm rounded-lg border border-line bg-surface px-3.5 py-2 font-medium hover:border-ink/30 transition-colors"
              >
                Open kitchen screen →
              </a>
              <a
                href="/dashboard/kitchen/qr?format=svg"
                className="text-sm rounded-lg border border-line bg-surface px-3.5 py-2 font-medium hover:border-ink/30 transition-colors"
              >
                Download card (SVG)
              </a>
              <a
                href="/dashboard/kitchen/qr?format=png"
                className="text-sm rounded-lg border border-line bg-surface px-3.5 py-2 font-medium hover:border-ink/30 transition-colors"
              >
                Download PNG
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight mb-1">
          Staff PINs
        </h2>
        <p className="text-sm text-muted mb-3">
          Whoever sets up the tablet needs their own PIN to sign in. Create
          one (or reset an existing one) from{" "}
          <Link href="/dashboard/staff/logins" className="text-pine hover:underline">
            Staff logins
          </Link>{" "}
          — PINs are shown once at creation, so have this open on another
          device while you set the tablet up.
        </p>
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight mb-3">
          Before service — a quick checklist
        </h2>
        <ul className="space-y-2.5">
          {CHECKLIST.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <span className="shrink-0 w-5 h-5 rounded border border-line mt-0.5" aria-hidden />
              <span className="text-ink-soft">{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
