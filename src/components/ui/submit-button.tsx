"use client";

import { useFormStatus } from "react-dom";

// Submit button that disables itself and shows a pending label while the
// server action runs. Used across auth and dashboard forms.
export function SubmitButton({
  children,
  pendingLabel = "Working…",
  className = "",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`w-full rounded-lg bg-pine px-4 py-2.5 font-medium text-white hover:bg-pine-deep disabled:opacity-60 disabled:cursor-not-allowed transition-colors ${className}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
