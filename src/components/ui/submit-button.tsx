"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonSize, type ButtonVariant } from "./button";

export { Spinner } from "./spinner";

// Submit button that disables itself and shows a pending label while the
// server action runs. Used across auth and dashboard forms. Built on the
// Phase 0 Button so it carries the same press feedback, focus ring and
// elevation as every other action in the system.
export function SubmitButton({
  children,
  pendingLabel = "Working…",
  className = "",
  variant = "primary",
  size = "md",
  disabled = false,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  // For a submit gated on something besides "is the action running" (e.g. a
  // required upload that hasn't happened yet) — combined with the pending
  // state Button already handles via `loading`, not a replacement for it.
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} full loading={pending} disabled={disabled} className={className}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
