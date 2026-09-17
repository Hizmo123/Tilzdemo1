"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function labelKey(slug: string) {
  return `tillz.kitchen.${slug}.deviceLabel`;
}

// The kitchen screen's header: venue nav, a one-tap fullscreen/kiosk toggle so
// staff can't accidentally swipe away mid-service, and a per-device label
// ("Pass", "Coffee station") so it's obvious which physical screen you're
// looking at when several are mounted around the kitchen. Fullscreen guards
// its own exit-navigation with a confirm, since leaving kiosk mode by
// accident mid-service is exactly what it's meant to prevent.
export function KitchenHeader({
  slug,
  activeCount,
  staffName,
}: {
  slug: string;
  // Undefined while the ticket data is still streaming in behind a Suspense
  // boundary — the header renders immediately either way, just without a
  // count for a moment rather than waiting on the same DB round trips.
  activeCount?: number;
  staffName: string;
}) {
  const router = useRouter();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [label, setLabel] = useState("");
  const [editing, setEditing] = useState(false);
  const [fsSupported, setFsSupported] = useState(true);

  useEffect(() => {
    setLabel(localStorage.getItem(labelKey(slug)) ?? "");
    setFsSupported(typeof document.documentElement.requestFullscreen === "function");
    function onChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [slug]);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  function saveLabel(v: string) {
    setLabel(v);
    localStorage.setItem(labelKey(slug), v);
  }

  function guardedNav(href: string) {
    if (isFullscreen && !window.confirm("Leave the kitchen screen?")) return;
    if (isFullscreen) document.exitFullscreen?.().catch(() => {});
    router.push(href);
  }

  return (
    <header className="border-b border-line bg-surface px-5 py-4 sticky top-0 z-30 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => guardedNav(`/staff/${slug}/home`)}
          className="text-sm text-muted hover:text-ink shrink-0"
        >
          ← Tables
        </button>
        <span className="font-display text-lg font-semibold tracking-tight shrink-0">
          Kitchen
        </span>
        {editing ? (
          <input
            autoFocus
            value={label}
            onChange={(e) => saveLabel(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
            placeholder="e.g. Pass"
            maxLength={20}
            className="w-24 rounded-md border border-line bg-paper px-2 py-1 text-xs focus:border-pine focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-muted hover:text-ink border border-dashed border-line rounded-md px-2 py-1 truncate max-w-[100px]"
            title="Name this screen"
          >
            {label || "Name screen"}
          </button>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {fsSupported && (
          <button
            onClick={toggleFullscreen}
            className="text-sm rounded-lg border border-line px-3 py-1.5 hover:border-ink/30"
          >
            {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          </button>
        )}
        <button
          onClick={() => guardedNav(`/staff/${slug}/history`)}
          className="text-sm rounded-lg border border-line px-3 py-1.5 hover:border-ink/30"
        >
          History
        </button>
        <span className="text-xs text-muted hidden sm:inline">
          {activeCount != null ? `${activeCount} active · ` : ""}
          {staffName}
        </span>
      </div>
    </header>
  );
}
