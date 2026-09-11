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

export function Input({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-muted/70 focus:border-pine focus:outline-none transition-colors ${className}`}
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
    <p className={`rounded-lg px-3.5 py-2.5 text-sm ${styles}`}>{children}</p>
  );
}
