"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Generic entry point for "where do I sign in as staff" — staff login is
// per-venue (/staff/[slug]), so there's no single link that works for every
// venue. In practice each venue prints its own QR/link (see Staff logins in
// the dashboard); this page exists for the case someone lands on the main
// site not knowing their venue's link and just has the venue's name/slug.
export default function StaffEntryPage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");

  function go() {
    const clean = slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/(^-|-$)/g, "");
    if (clean) router.push(`/staff/${clean}`);
  }

  return (
    <main className="min-h-dvh bg-paper flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm text-center">
        <Link href="/" className="text-sm text-muted hover:text-ink inline-block mb-4">
          ← Tillz
        </Link>
        <p className="text-sm font-medium text-pine">Staff sign in</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight mt-0.5">
          Which venue do you work at?
        </h1>
        <p className="text-sm text-muted mt-2">
          Ask your manager for your venue&apos;s sign-in link or QR code — it&apos;s
          the fastest way in. Or enter your venue below.
        </p>

        <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-6">
          <label htmlFor="venue" className="text-sm text-muted block mb-1.5 text-left">
            Venue name or code
          </label>
          <input
            id="venue"
            autoFocus
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") go();
            }}
            placeholder="e.g. harbour-kitchen"
            className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 focus:border-pine focus:outline-none"
          />
          <button
            onClick={go}
            disabled={!slug.trim()}
            className="mt-4 w-full rounded-xl bg-pine text-white py-3 font-medium hover:bg-pine-deep disabled:opacity-50 transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </main>
  );
}
