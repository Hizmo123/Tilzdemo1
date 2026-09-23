"use client";

import { motion } from "motion/react";
import { MENU_LAYOUTS, type MenuLayout } from "@/lib/menu-style";
import { SPRING_PRESS } from "@/components/ui/motion";

// The four named menu presets from lib/menu-style.ts, each with a tiny
// wireframe of what that layout does to an item list. Onboarding only picks
// the preset; every finer axis (image aspect, borders, dividers, type scale,
// button shape…) stays in Settings → Appearance. Both read from
// MENU_LAYOUTS, so adding a layout there adds it here.
export function MenuLayoutPicker({
  value,
  onChange,
}: {
  value: MenuLayout;
  onChange: (value: MenuLayout) => void;
}) {
  return (
    <div role="radiogroup" className="grid grid-cols-2 gap-2">
      {MENU_LAYOUTS.map((l) => {
        const active = value === l.value;
        return (
          <motion.button
            key={l.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(l.value)}
            whileTap={{ scale: 0.98 }}
            transition={SPRING_PRESS}
            className={`text-left rounded-[var(--radius-md)] bg-surface p-2.5 transition-[box-shadow,background-color] duration-[var(--dur-fast)] ${
              active ? "ring-2 ring-pine shadow-raised bg-pine-tint" : "border border-line shadow-rest hover:shadow-raised"
            }`}
          >
            <Wire layout={l.value} active={active} />
            <span className="block text-xs font-medium mt-2">{l.label}</span>
            <span className="block text-[11px] text-muted mt-0.5 leading-snug">{l.desc}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

// Miniature of the layout: bars for text, blocks for photos. Uses the
// surface-2 / line tokens so it stays neutral under any venue theme.
function Wire({ layout, active }: { layout: MenuLayout; active: boolean }) {
  const ink = active ? "bg-pine/60" : "bg-ink/30";
  const soft = active ? "bg-pine/25" : "bg-ink/12";
  const photo = active ? "bg-pine/35" : "bg-ink/20";
  const frame = "h-16 rounded-[var(--radius-sm)] bg-surface-2 p-1.5 overflow-hidden";

  if (layout === "grid") {
    return (
      <div className={`${frame} grid grid-cols-2 gap-1`}>
        {[0, 1].map((i) => (
          <div key={i} className="space-y-1">
            <div className={`h-7 rounded-[3px] ${photo}`} />
            <div className={`h-1.5 w-3/4 rounded-[2px] ${ink}`} />
            <div className={`h-1 w-1/2 rounded-[2px] ${soft}`} />
          </div>
        ))}
      </div>
    );
  }
  if (layout === "magazine") {
    return (
      <div className={`${frame} space-y-1`}>
        <div className={`h-2 w-1/2 rounded-[2px] ${ink}`} />
        <div className={`h-6 rounded-[3px] ${photo}`} />
        <div className={`h-1.5 w-2/3 rounded-[2px] ${ink}`} />
        <div className={`h-1 w-1/2 rounded-[2px] ${soft}`} />
      </div>
    );
  }
  if (layout === "minimal") {
    return (
      <div className={`${frame} space-y-[7px] pt-2.5`}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className={`h-1.5 rounded-[2px] ${ink}`} style={{ width: `${55 - i * 10}%` }} />
            <div className={`flex-1 border-b border-dotted ${active ? "border-pine/40" : "border-ink/20"}`} />
            <div className={`h-1.5 w-3 rounded-[2px] ${ink}`} />
          </div>
        ))}
      </div>
    );
  }
  // list
  return (
    <div className={`${frame} space-y-1.5`}>
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className={`w-5 h-5 shrink-0 rounded-[3px] ${photo}`} />
          <div className="flex-1 space-y-1">
            <div className={`h-1.5 w-3/4 rounded-[2px] ${ink}`} />
            <div className={`h-1 w-1/2 rounded-[2px] ${soft}`} />
          </div>
          <div className={`h-1.5 w-3 rounded-[2px] ${ink}`} />
        </div>
      ))}
    </div>
  );
}
