import type { IconKey } from "@/lib/onboarding-options";

// Small, generic line icons for the wizard's selectable cards, drawn inline in
// the same raw-SVG style already used in mobile-nav.tsx — no icon package, so
// nothing new to install and nothing that could drift from the design system.
const PATHS: Record<IconKey, React.ReactNode> = {
  cafe: (
    <>
      <path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z" />
      <path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17" />
      <path d="M7 4.5c0 1-1 1-1 2s1 1 1 2" />
      <path d="M11 4.5c0 1-1 1-1 2s1 1 1 2" />
    </>
  ),
  restaurant: (
    <>
      <path d="M6 3v7a2 2 0 0 0 2 2v9" />
      <path d="M6 3v5M9 3v5" />
      <path d="M17 3c-1.5 0-2.5 1.5-2.5 4s1 4 1 4v10" />
    </>
  ),
  bar: (
    <>
      <path d="M5 4h14l-6 8v7M12 12v7M9 19h6" />
    </>
  ),
  bakery: (
    <>
      <path d="M4 12c0-3 3.5-8 8-8s8 5 8 8" />
      <path d="M3 12h18l-1.5 7a2 2 0 0 1-2 1.6H6.5A2 2 0 0 1 4.5 19L3 12Z" />
    </>
  ),
  truck: (
    <>
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17.5" cy="18" r="1.6" />
    </>
  ),
  bolt: <path d="M13 3 4 14h6l-1 7 9-11h-6l1-7Z" />,
  star: (
    <path d="M12 3.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8L12 3.5Z" />
  ),
  building: (
    <>
      <path d="M5 21V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16" />
      <path d="M13 21V10a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v11" />
      <path d="M8 7h.01M8 11h.01M8 15h.01" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
    </>
  ),
  droplet: (
    <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />
  ),
  dots: (
    <>
      <circle cx="6" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="18" cy="12" r="1.4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M15.5 14a5 5 0 0 1 5.5 5" />
    </>
  ),
  qr: (
    <>
      <rect x="3.5" y="3.5" width="6" height="6" rx="0.5" />
      <rect x="14.5" y="3.5" width="6" height="6" rx="0.5" />
      <rect x="3.5" y="14.5" width="6" height="6" rx="0.5" />
      <path d="M14.5 15h2.2v2.2M20.5 15v2.2h-2.2M14.5 20.5h2.2v-2.2M20.5 20.5h-2.2" />
    </>
  ),
  storefront: (
    <>
      <path d="M4 9l1-5h14l1 5" />
      <path d="M4 9a2.2 2.2 0 0 0 4.4 0 2.2 2.2 0 0 0 4.4 0 2.2 2.2 0 0 0 4.4 0 2.2 2.2 0 0 0 2.8.6V21H5V9.6c.3.2.6.4 1 .4" />
      <path d="M9 21v-6h6v6" />
    </>
  ),
  bag: (
    <>
      <path d="M6 8h12l1 12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  shuffle: (
    <>
      <path d="M3 6h3.5L15 18h6" />
      <path d="M18 6h3v3M3 18h3.5L11 12" />
      <path d="M18 18h3v-3" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    </>
  ),
  cart: (
    <>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
      <path d="M3 4h2l2.4 12.2a1.5 1.5 0 0 0 1.5 1.3h8.4a1.5 1.5 0 0 0 1.5-1.2L21 8H6" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <path d="M6.5 14.5h4" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 6h9M17 6h3M4 12h3M9 12h11M4 18h13M19 18h1" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="7" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
};

export function Icon({
  name,
  className = "w-5 h-5",
}: {
  name: IconKey;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
