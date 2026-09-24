// The Button's chrome as plain class strings, in a module with NO "use
// client" directive — so a Server Component can put the exact same
// variant/size on a <Link> or <a> (buttonClasses) instead of hand-rolling
// `rounded-lg border px-3 py-1.5`, which is how the dashboard and staff
// screens ended up with a dozen near-miss button sizes and radii.
// components/ui/button.tsx (the animated <Button>/<LinkButton>) imports and
// re-exports everything here, so existing client imports are unchanged.

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft" | "ink";
export type ButtonSize = "sm" | "md" | "lg";

export const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  // The one loud action on a screen. Accent gradient + accent glow, so it
  // re-themes to the venue colour on customer pages.
  primary:
    "bg-accent-gradient text-on-accent shadow-accent hover:brightness-105 active:brightness-95",
  secondary:
    "bg-surface text-ink border border-line shadow-rest hover:border-line-strong hover:shadow-raised",
  ghost: "bg-transparent text-ink-soft hover:bg-surface-2 hover:text-ink",
  soft: "bg-pine-soft text-pine-deep hover:brightness-95",
  ink: "bg-ink text-surface hover:opacity-90",
  danger: "bg-danger text-white hover:brightness-95",
};

export const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm rounded-[var(--radius-sm)]",
  md: "h-11 px-5 text-sm rounded-[var(--radius-md)]",
  lg: "h-13 min-h-[52px] px-6 text-base rounded-[var(--radius-lg)]",
};

export const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 font-medium select-none transition-[filter,box-shadow,border-color,background-color] duration-[var(--dur-fast)]";

export function buttonClasses(variant: ButtonVariant, size: ButtonSize, full = false, extra = "") {
  return `${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${BUTTON_SIZE[size]} ${full ? "w-full" : ""} ${extra}`;
}
