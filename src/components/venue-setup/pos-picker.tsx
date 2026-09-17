"use client";

// One honest question, not a generic POS brand list: does this venue use
// Square today, and if so, would they like to eventually connect it. Square
// is the only POS asked about because it's the only one with a real
// integration on the roadmap (Delivery 1b, payment processing only — never
// order sync, never ongoing menu sync). Asking about brands with no
// integration plan would just collect hope.
export function PosPicker({
  usesSquare,
  wantsConnect,
  onUsesSquareChange,
  onWantsConnectChange,
}: {
  usesSquare: boolean | null;
  wantsConnect: boolean;
  onUsesSquareChange: (value: boolean) => void;
  onWantsConnectChange: (value: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {([
          [true, "Yes"],
          [false, "No"],
        ] as const).map(([v, label]) => (
          <button
            key={label}
            type="button"
            onClick={() => onUsesSquareChange(v)}
            className={`rounded-[var(--radius-card)] border-2 px-6 py-2.5 text-sm font-medium transition-colors ${
              usesSquare === v
                ? "border-pine bg-pine-soft text-pine-deep"
                : "border-line hover:border-ink/20"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {usesSquare && (
        <div className="rounded-[var(--radius-card)] border border-line bg-paper p-4">
          <p className="text-sm font-medium mb-1">Connect your Square account?</p>
          <p className="text-xs text-muted mb-3 leading-relaxed">
            Card payments taken through Tillz would settle straight into your
            existing Square account, alongside your in-person takings, and
            you could do a one-time import of your Square menu. This does{" "}
            <strong className="text-ink-soft">not</strong> sync orders to your
            Square POS and does not keep your menus in sync afterwards — it's
            a one-time copy, not ongoing mirroring.
          </p>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={wantsConnect}
              onChange={(e) => onWantsConnectChange(e.target.checked)}
              className="accent-pine w-4 h-4"
            />
            Yes, I&apos;d like to connect Square when it&apos;s available
          </label>
          {wantsConnect && (
            <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2 mt-3">
              Square connection isn&apos;t available yet — we&apos;ve noted
              your interest and it&apos;ll be ready for you to connect as
              soon as it lands.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
