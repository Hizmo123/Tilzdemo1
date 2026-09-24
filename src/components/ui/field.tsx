import * as React from "react";

export function Label({
  className = "",
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`block text-sm font-medium text-ink-soft mb-1.5 ${className}`}
      {...props}
    />
  );
}

// Text input on the Phase 0 tokens: 44px tall (tap target), radius-md like
// the md Button so a field and the button under it line up, resting shadow,
// accent focus ring. `invalid` (or aria-invalid) swaps the ring to danger.
// `ref` forwards straight to the DOM node — React 19's ref-as-prop, no
// forwardRef wrapper needed — for callers that need to read/set the
// uncontrolled input imperatively (e.g. filling in a scanned value).
export function Input({
  className = "",
  invalid,
  ref,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; ref?: React.Ref<HTMLInputElement> }) {
  const isInvalid = invalid || props["aria-invalid"] === true || props["aria-invalid"] === "true";
  return (
    <input
      ref={ref}
      aria-invalid={isInvalid || undefined}
      className={`w-full h-11 rounded-[var(--radius-md)] bg-surface px-3.5 text-ink placeholder:text-muted/70 border shadow-rest transition-[border-color,box-shadow] duration-[var(--dur-fast)] focus:outline-none focus:ring-[3px] ${
        isInvalid
          ? "border-danger focus:border-danger focus:ring-danger/20"
          : "border-line hover:border-line-strong focus:border-pine focus:ring-pine/20"
      } ${className}`}
      {...props}
    />
  );
}

// Inline form-level message. `tone` picks error vs neutral styling.
export function FormMessage({
  children,
  tone = "error",
}: {
  children: React.ReactNode;
  tone?: "error" | "info";
}) {
  if (!children) return null;
  const styles =
    tone === "error"
      ? "bg-danger-soft text-danger"
      : "bg-pine-soft text-pine-deep";
  return (
    <p role={tone === "error" ? "alert" : undefined} className={`rounded-[var(--radius-sm)] px-3.5 py-2.5 text-sm ${styles}`}>
      {children}
    </p>
  );
}
