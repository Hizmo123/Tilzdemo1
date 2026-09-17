// KPI card with an optional "vs previous period" change indicator. changePct
// is null when there's no prior-period baseline to compare against (e.g. a
// brand-new venue) — shown as a plain dash rather than a misleading 0%/100%.
export function StatCard({
  label,
  value,
  changePct,
}: {
  label: string;
  value: string;
  changePct?: number | null;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-2xl font-semibold tracking-tight mt-1 tabular-nums">
        {value}
      </p>
      {changePct !== undefined && (
        <p
          className={`text-xs mt-1.5 tabular-nums ${
            changePct === null
              ? "text-muted"
              : changePct > 0
                ? "text-pine-deep"
                : changePct < 0
                  ? "text-danger"
                  : "text-muted"
          }`}
        >
          {changePct === null
            ? "No prior period to compare"
            : `${changePct > 0 ? "▲" : changePct < 0 ? "▼" : "–"} ${Math.abs(changePct).toFixed(1)}% vs previous period`}
        </p>
      )}
    </div>
  );
}
