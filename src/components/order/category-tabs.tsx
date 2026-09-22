"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chip } from "@/components/ui/chip";

// Sticky category chips that scroll-spy the menu: the chip for the section
// you're looking at is highlighted, and tapping one smooth-scrolls there.
// Shared by the interactive menu (MenuOrderer) and the read-only one
// (MenuDisplay, also /m/[slug]). Native scrollbar hidden; overflow is hinted
// with edge fades instead.
//
// Sections must render as <section id={sectionId(cat.id)}> — see below.

export function sectionId(categoryId: string) {
  return `menu-cat-${categoryId}`;
}

// Where the sticky chip row ends, so scroll-to lands the heading just below
// it rather than underneath it.
const STICKY_OFFSET = 116;

export function useScrollSpy(ids: string[]) {
  const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null);
  // A programmatic scroll shouldn't let intermediate sections steal the
  // highlight on the way past — hold the tapped one until the scroll settles.
  const lockUntil = useRef(0);

  useEffect(() => {
    if (ids.length === 0) return;
    const els = ids.map((id) => document.getElementById(sectionId(id))).filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;

    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = e.target.id.replace("menu-cat-", "");
          if (e.isIntersecting) visible.set(id, e.boundingClientRect.top);
          else visible.delete(id);
        }
        if (Date.now() < lockUntil.current) return;
        // Highest visible section (closest to the top of the viewport) wins.
        let best: string | null = null;
        let bestTop = Infinity;
        for (const [id, top] of visible) {
          if (top < bestTop) {
            bestTop = top;
            best = id;
          }
        }
        if (best) setActiveId(best);
      },
      { rootMargin: `-${STICKY_OFFSET}px 0px -55% 0px`, threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(sectionId(id));
    if (!el) return;
    setActiveId(id);
    lockUntil.current = Date.now() + 700;
    const top = el.getBoundingClientRect().top + window.scrollY - STICKY_OFFSET + 8;
    window.scrollTo({ top, behavior: "smooth" });
  }, []);

  return { activeId, scrollTo };
}

export function CategoryNav({
  categories,
  activeId,
  onSelect,
}: {
  categories: { id: string; name: string }[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  // Keep the active chip in view as the spy moves it.
  useEffect(() => {
    const row = rowRef.current;
    if (!row || !activeId) return;
    const chip = row.querySelector<HTMLElement>(`[data-cat="${activeId}"]`);
    if (!chip) return;
    const left = chip.offsetLeft - row.clientWidth / 2 + chip.clientWidth / 2;
    row.scrollTo({ left, behavior: "smooth" });
  }, [activeId]);

  if (categories.length <= 1) return null;

  return (
    <div className="sticky top-0 z-20 -mx-5 px-5 py-2.5 glass border-x-0 rounded-none">
      <div ref={rowRef} className="flex gap-2 overflow-x-auto no-scrollbar fade-x -mx-1 px-1">
        {categories.map((cat) => (
          <span key={cat.id} data-cat={cat.id} className="shrink-0">
            <Chip selected={activeId === cat.id} onClick={() => onSelect(cat.id)}>
              {cat.name}
            </Chip>
          </span>
        ))}
      </div>
    </div>
  );
}
