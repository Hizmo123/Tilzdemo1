import type { HTMLAttributes } from "react";

type Elevation = "flat" | "rest" | "raised" | "float";

const ELEVATION: Record<Elevation, string> = {
  flat: "border border-line",
  rest: "border border-line shadow-rest",
  raised: "shadow-raised",
  float: "shadow-float",
};

// The one card. Radius follows the venue's corner choice (--radius-card) on
// customer pages and the 14px default on the dashboard; elevation is the
// only thing that should vary between cards on a screen — pick ONE raised
// or floating element per view so it reads as the focal point.
export function Card({
  elevation = "rest",
  padded = true,
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { elevation?: Elevation; padded?: boolean }) {
  return (
    <div
      className={`rounded-[var(--radius-card)] bg-surface ${ELEVATION[elevation]} ${padded ? "p-5" : ""} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
