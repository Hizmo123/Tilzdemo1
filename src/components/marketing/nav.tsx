"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";

// Marketing header. Transparent over the hero; once the page has scrolled
// it picks up the frosted "glass" treatment and a resting shadow so it
// reads as a bar sitting on the content rather than part of it. Only a
// background/shadow change — nothing moves.
export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-[background-color,box-shadow,border-color] duration-[var(--dur-base)] ${
        scrolled ? "glass shadow-rest" : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight">
          Tillz
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/staff"
            className="hidden sm:inline-flex h-11 items-center text-sm text-ink-soft hover:text-ink px-3 rounded-[var(--radius-md)]"
          >
            Staff sign in
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center text-sm text-ink-soft hover:text-ink px-3 rounded-[var(--radius-md)]"
          >
            Log in
          </Link>
          <LinkButton href="/signup" variant="ink" size="sm" className="h-10">
            Get started
          </LinkButton>
        </nav>
      </div>
    </header>
  );
}
