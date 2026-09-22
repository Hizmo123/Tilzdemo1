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
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} full loading={pending} className={className}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
