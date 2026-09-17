// Orders-by-hour-of-day bar chart — same inline-SVG approach as the revenue
// chart, but for plain counts (busiest times), not money.
export function HourlyChart({ data }: { data: { hour: number; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const height = 140;
  const gap = 0.6;
  const barWidth = (100 - gap * (data.length - 1)) / data.length;

  if (data.every((d) => d.count === 0)) {
    return (
      <div className="flex items-center justify-center text-sm text-muted" style={{ height }}>
        No orders in this period yet.
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
        aria-label="Orders by hour of day"
      >
        {data.map((d, i) => {
          const barH = Math.max(1, (d.count / max) * (height - 16));
          const x = i * (barWidth + gap);
          const y = height - 16 - barH;
          return (
            <g key={i}>
              <title>
                {formatHour(d.hour)}: {d.count} order{d.count === 1 ? "" : "s"}
              </title>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={0.8}
                className="fill-pine"
                opacity={d.count === 0 ? 0.12 : 0.85}
              />
            </g>
          );
        })}
      </svg>
      <div className="flex mt-1">
        {data.map((d, i) => (
          <div
            key={i}
            className="text-center text-[9px] text-muted"
            style={{ width: `${barWidth}%`, marginRight: i < data.length - 1 ? `${gap}%` : 0 }}
          >
            {d.hour % 3 === 0 ? d.hour : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatHour(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}${hour < 12 ? "am" : "pm"}`;
}
