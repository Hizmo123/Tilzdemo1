"use client";

// Only offers what the product actually does: a kitchen chime toggle, and an
// info row for dashboard live refresh, which is unconditional today and has
// no setting to attach to. The "text me when it's ready" capture used to
// have its own on/off toggle here — removed as a confusing extra setup
// decision; it's simply always offered to customers now (who opt in or not
// per-order just by choosing to leave a number, which was always the real
// privacy control point, not this venue-level setting).
export function NotificationsPicker({
  kitchenChime,
  onKitchenChimeChange,
}: {
  kitchenChime: boolean;
  onKitchenChimeChange: (value: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium mb-2">Kitchen screen chime</p>
        <div className="grid grid-cols-2 gap-2">
          <Pill active={kitchenChime} onClick={() => onKitchenChimeChange(true)}>
            On
          </Pill>
          <Pill active={!kitchenChime} onClick={() => onKitchenChimeChange(false)}>
            Off
          </Pill>
        </div>
        <p className="text-xs text-muted mt-1.5">
          Chimes on the kitchen board when a new ticket comes in.
        </p>
      </div>

      <div className="rounded-lg bg-paper px-3.5 py-2.5">
        <p className="text-sm text-ink-soft">
          &ldquo;Text me when it&apos;s ready&rdquo; for customers
        </p>
        <p className="text-xs text-muted mt-0.5">
          Always offered to guests after ordering — needs Twilio configured to
          actually send; otherwise the number is just collected, unused.
        </p>
      </div>

      <div className="rounded-lg bg-paper px-3.5 py-2.5">
        <p className="text-sm text-ink-soft">Dashboard live refresh</p>
        <p className="text-xs text-muted mt-0.5">
          Already on for every venue — the dashboard and kitchen board refresh
          themselves automatically. Nothing to configure.
        </p>
      </div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
        active ? "border-pine bg-pine-soft text-pine-deep" : "border-line hover:border-ink/20"
      }`}
    >
      {children}
    </button>
  );
}
