"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function storageKey(slug: string) {
  return `tillz.kitchen.${slug}.station`;
}

// Remembers the selected station tab (and redirects to it on a bare reload)
// so a screen mounted as "Bar" is still the bar screen after a reload or a
// power cycle — previously this only lived in the URL, which a fresh load
// with no ?station= param would lose.
export function StationTabs({
  slug,
  stations,
  active,
}: {
  slug: string;
  stations: string[];
  active: string | null;
}) {
  const router = useRouter();

  // On mount with no explicit ?station= in the URL, jump to the last saved
  // one for this device — but only once, and only if it's still a real
  // station (a station renamed/removed since just falls through to "All").
  useEffect(() => {
    if (active) return;
    const saved = localStorage.getItem(storageKey(slug));
    if (saved && stations.includes(saved)) {
      router.replace(`/staff/${slug}/kitchen?station=${encodeURIComponent(saved)}`);
    }
    // Intentionally only on mount — this is a one-time "restore last station"
    // jump, not something that should re-fire as props change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function remember(station: string | null) {
    if (station) localStorage.setItem(storageKey(slug), station);
    else localStorage.removeItem(storageKey(slug));
  }

  const tabClass = (on: boolean) =>
    `text-sm rounded-lg px-3 py-1 transition-colors ${
      on ? "bg-pine text-[color:var(--on-accent,#fff)]" : "border border-line hover:border-ink/30"
    }`;

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={`/staff/${slug}/kitchen`}
        onClick={() => remember(null)}
        className={tabClass(!active)}
      >
        All
      </Link>
      {stations.map((s) => (
        <Link
          key={s}
          href={`/staff/${slug}/kitchen?station=${encodeURIComponent(s)}`}
          onClick={() => remember(s)}
          className={tabClass(active === s)}
        >
          {s}
        </Link>
      ))}
    </div>
  );
}
