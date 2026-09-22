"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { label: string; href: string };
export type NavSection = { label: string; items: NavItem[] };

// Persisted across reloads/navigation, shared between the desktop sidebar and
// the mobile drawer (both render this same component) — collapsing "Money"
// on one surface collapses it on the other too, since it's the same nav for
// the same user in the same browser.
const STORAGE_KEY = "tillz_dashboard_nav_collapsed";

function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    // Private mode / corrupted value — default to everything expanded.
    return new Set();
  }
}

function saveCollapsed(collapsed: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsed]));
  } catch {
    // Nothing to do — collapse state just won't survive this session.
  }
}

// Renders the dashboard's grouped nav links with a collapsible section
// header (label + chevron, click to fold/unfold that section's links).
// RBAC filtering happens server-side in layout.tsx before `sections` ever
// reaches here — this component only decides what's EXPANDED, never what's
// VISIBLE.
export function NavSections({
  sections,
  onNavigate,
}: {
  sections: NavSection[];
  // Mobile passes this to close the drawer after a link tap; the desktop
  // sidebar has nothing to close, so it's optional.
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  // Empty set = everything expanded, the default — matches server-rendered
  // markup so there's no hydration flash before the localStorage read below
  // can run (client-only, since localStorage doesn't exist during SSR).
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCollapsed(loadCollapsed());
  }, []);

  function toggle(label: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      saveCollapsed(next);
      return next;
    });
  }

  return (
    <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
      {sections.map((section) => {
        const isOpen = !collapsed.has(section.label);
        return (
          <div key={section.label}>
            <button
              type="button"
              onClick={() => toggle(section.label)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-2 px-3 mb-1 text-xs font-medium uppercase tracking-wide text-muted hover:text-ink transition-colors"
            >
              <span>{section.label}</span>
              <svg
                viewBox="0 0 20 20"
                fill="none"
                className={`shrink-0 w-3 h-3 transition-transform ${isOpen ? "" : "-rotate-90"}`}
              >
                <path
                  d="M5 7.5L10 12.5L15 7.5"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {isOpen && (
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
                      onClick={onNavigate}
                      className={`flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${
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
            )}
          </div>
        );
      })}
    </nav>
  );
}
