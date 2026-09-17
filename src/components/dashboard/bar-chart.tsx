import { formatCents } from "@/lib/money";

// A small, dependency-free revenue-over-time bar chart. No charting library —
// just inline SVG, consistent with the rest of the app's zero-extra-deps
// approach. `<title>` gives an accessible native tooltip on hover/focus.
export function RevenueBarChart({
  data,
  currency,
  height = 160,
}: {
  data: { label: string; valueCents: number }[];
  currency: string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.valueCents));
  const n = Math.max(1, data.length);
  const gap = 1.5;
  const barWidth = (100 - gap * (n - 1)) / n;

  if (data.every((d) => d.valueCents === 0)) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted"
        style={{ height }}
      >
        No revenue in this period yet.
      </div>
    );
  }

  return (
    <div>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label="Revenue over time"
      >
        {data.map((d, i) => {
          const barH = Math.max(1, (d.valueCents / max) * (height - 20));
          const x = i * (barWidth + gap);
          const y = height - 20 - barH;
          return (
            <g key={i}>
              <title>
                {d.label}: {formatCents(d.valueCents, currency)}
              </title>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={1.2}
                className="fill-pine"
                opacity={d.valueCents === 0 ? 0.15 : 0.85}
              />
            </g>
          );
        })}
      </svg>
      <div className="flex mt-1.5" style={{ gap: `${gap}%` }}>
        {data.map((d, i) => (
          <div
            key={i}
            className="text-center text-[10px] text-muted truncate"
            style={{ width: `${barWidth}%` }}
          >
            {data.length > 14 && i % Math.ceil(data.length / 10) !== 0 ? "" : d.label}
          </div>
        ))}
      </div>
    </div>
  );
}
