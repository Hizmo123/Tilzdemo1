import { appBaseUrl } from "@/lib/urls";
import { qrDataUrlForUrl } from "@/lib/qr";
import { NfcSection } from "@/app/dashboard/tables/[tableId]/nfc-section";

// One QR/URL for every table — Lite's whole "public serving surface" (see
// src/app/m/[slug]/page.tsx). Shown on the Lite Overview and on Settings >
// Venue details, both server-rendered from the same restaurant slug.
export async function PublicMenuLink({ slug }: { slug: string }) {
  const url = `${appBaseUrl()}/m/${slug}`;
  const preview = await qrDataUrlForUrl(url);

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 flex flex-wrap items-center gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="" className="w-28 h-28 shrink-0" width={112} height={112} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold tracking-tight mb-1">
            Your public menu
          </h2>
          <p className="text-sm text-muted mb-2">
            One code for all your tables — no cart, just the menu.
          </p>
          <p className="text-sm break-all mb-3">{url}</p>
          <div className="flex flex-wrap gap-2">
            <a
              href="/dashboard/menu/qr?format=svg"
              className="rounded-[var(--radius-sm)] border border-line bg-surface px-3.5 py-2 text-sm font-medium hover:border-ink/30 transition-colors"
            >
              Download card (SVG)
            </a>
            <a
              href="/dashboard/menu/qr?format=png"
              className="rounded-[var(--radius-sm)] border border-line bg-surface px-3.5 py-2 text-sm font-medium hover:border-ink/30 transition-colors"
            >
              Download PNG
            </a>
          </div>
        </div>
      </div>

      <NfcSection url={url} />
    </div>
  );
}
