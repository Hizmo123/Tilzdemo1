// A plain animated ring — no icon library, matches the "zero new
// dependencies" rule the rest of this project follows. Lives in its own
// module so Button and SubmitButton can both use it without a cycle.
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin h-4 w-4 shrink-0 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
