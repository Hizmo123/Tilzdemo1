"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "../(auth)/actions";

type NavItem = { label: string; href: string };
type NavSection = { label: string; items: NavItem[] };

// Mobile top bar + slide-over drawer. The desktop sidebar is hidden below `md`,
// so without this a phone has no way to reach Tables/Orders/Team/etc. The nav
// sections are computed server-side (permission-filtered, grouped) in the
// layout and passed in, so this component never decides who can see what.
export function MobileNav({
  sections,
  restaurantName,
  userEmail,
  showVenueSwitcher = false,
}: {
  sections: NavSection[];
  restaurantName: string;
  userEmail: string;
  showVenueSwitcher?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the route changes (i.e. after a nav tap lands).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 -ml-2 text-ink hover:bg-paper transition-colors"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <span className="font-display text-lg font-semibold">Tillz</span>
        </button>
        <span className="text-xs text-muted truncate max-w-[45%]">
          {restaurantName}
        </span>
      </header>

      {open && (
        <div className="md:hidden fixed inset-0 z-40">
          {/* Scrim */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40"
          />
          {/* Drawer */}
          <div className="absolute inset-y-0 left-0 w-72 max-w-[82%] bg-surface flex flex-col shadow-xl">
            <div className="px-5 py-5 border-b border-line flex items-center justify-between">
              <div className="min-w-0">
                <span className="font-display text-lg font-semibold tracking-tight">
                  Tillz
                </span>
                <p className="text-xs text-muted mt-0.5 truncate">
                  {restaurantName}
                </p>
                {showVenueSwitcher && (
                  <Link
                    href="/venues"
                    prefetch={false}
                    onClick={() => setOpen(false)}
                    className="text-xs text-pine hover:underline mt-0.5 inline-block"
                  >
                    Switch venue
                  </Link>
                )}
              </div>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-muted hover:bg-paper hover:text-ink transition-colors"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
              {sections.map((section) => (
                <div key={section.label}>
                  <p className="px-3 mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                    {section.label}
                  </p>
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const active =
                        item.href === "/dashboard"
                          ? pathname === "/dashboard"
                          : pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.label}
                          href={item.href}
                          prefetch={false}
                          onClick={() => setOpen(false)}
                          className={`flex items-center rounded-lg px-3 py-2.5 text-sm transition-colors ${
                            active
                              ? "bg-pine-soft text-pine-deep font-medium"
                              : "text-ink hover:bg-paper"
                          }`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="border-t border-line px-5 py-4 pb-6 space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <Link
                  href="/dashboard/help"
                  prefetch={false}
                  onClick={() => setOpen(false)}
                  className="text-ink-soft hover:text-ink transition-colors"
                >
                  Help
                </Link>
                <Link
                  href="/support"
                  prefetch={false}
                  onClick={() => setOpen(false)}
                  className="text-ink-soft hover:text-ink transition-colors"
                >
                  Support
                </Link>
              </div>
              <p className="text-xs text-muted truncate">{userEmail}</p>
              <form action={signOut}>
                <button
                  type="submit"
                  className="text-sm text-ink-soft hover:text-danger transition-colors"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
