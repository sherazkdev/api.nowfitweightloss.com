import type { ReactNode } from "react";

function smoothPath(points: ReadonlyArray<readonly [number, number]>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

export function WebsiteBars({
  items,
}: {
  items: { label: string; value: number; emphasis?: boolean }[];
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="flex h-full flex-col justify-center gap-3 py-1">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="w-16 shrink-0 truncate text-[12px] leading-[18px] sm:w-[88px]">{item.label}</span>
          <div className="relative h-2 flex-1">
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
              style={{
                width: `${(item.value / max) * 100}%`,
                height: item.emphasis ? 8 : 2,
                background: item.emphasis ? "var(--chart-bar-emphasis)" : "var(--text-primary)",
                opacity: item.emphasis ? 1 : 0.35,
              }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-[12px] leading-[18px] text-[var(--text-muted)]">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function VerticalBars({
  items,
}: {
  items: { label: string; value: number; color: string }[];
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="flex h-[140px] min-w-0 items-end gap-2 overflow-x-auto px-1 md:h-[160px] md:gap-4 md:px-2">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <span className="text-[11px] leading-4 text-[var(--text-muted)]">{item.value}</span>
          <div className="flex h-[100px] w-full items-end justify-center md:h-[120px]">
            <div
              className="w-3.5 rounded-full md:w-5"
              style={{
                height: `${Math.max((item.value / max) * 100, 3)}%`,
                background: item.color,
              }}
            />
          </div>
          <span className="truncate text-[12px] leading-[18px] text-[var(--text-muted)]">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function DonutChart({
  items,
}: {
  items: { label: string; value: number; color: string }[];
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const safeTotal = total || 1;
  const radius = 48;
  const stroke = 16;
  const circ = 2 * Math.PI * radius;
  const gap = items.length > 1 ? 5 : 0;
  const usable = circ - gap * items.length;
  const lengths = items.map((item) => (item.value / safeTotal) * usable);
  const slices = items.map((item, index) => {
    const offset = lengths.slice(0, index).reduce((sum, length) => sum + length + gap, 0);
    return { ...item, dash: `${lengths[index]} ${circ - lengths[index]}`, offset };
  });

  return (
    <div className="flex min-w-0 flex-col items-center gap-4 overflow-hidden sm:flex-row sm:items-center">
      <svg viewBox="0 0 140 140" className="size-[120px] shrink-0 md:size-[132px]">
        <g transform="rotate(-90 70 70)">
          {slices.map((item) => (
            <circle
              key={item.label}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={item.dash}
              strokeDashoffset={-item.offset}
            />
          ))}
        </g>
      </svg>
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const pct = total ? Math.round((item.value / total) * 100) : 0;
          return (
            <li key={item.label} className="flex items-center gap-2 text-[12px] leading-[18px]">
              <span className="size-1.5 rounded-full" style={{ background: item.color }} />
              <span className="min-w-[56px] text-[var(--text-muted)]">{item.label}</span>
              <span>
                {item.value}
                <span className="text-[var(--text-muted)]"> · {pct}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DashboardCard({
  title,
  extra,
  children,
  className = "",
}: {
  title: string;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`wl-enter flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] p-3 md:p-4 ${className}`}>
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <h2 className="text-[14px] font-semibold leading-5">{title}</h2>
        {extra}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "purple";
}) {
  return (
    <article
      className="wl-enter wl-card-hover rounded-[16px] p-3 md:p-4"
      style={{ background: tone === "blue" ? "var(--pastel-blue)" : "var(--pastel-purple)" }}
    >
      <p className="text-[12px] leading-[18px] text-[var(--static-black)]">{label}</p>
      <p className="mt-1 text-[20px] font-semibold leading-7 tracking-[-0.02em] text-[var(--static-black)]">
        {value}
      </p>
    </article>
  );
}

/** Real-valued area chart — unused on the dashboard until a trend series exists. */
export function LineChart({
  current,
  previous,
  labels,
}: {
  current: number[];
  previous: number[];
  labels: string[];
}) {
  const width = 640;
  const height = 180;
  const pad = { top: 12, right: 10, bottom: 24, left: 32 };
  const max = Math.max(...current, ...previous, 1);
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const last = Math.max(labels.length - 1, 1);
  const x = (index: number) => pad.left + (index / last) * innerW;
  const y = (value: number) => pad.top + innerH - (value / max) * innerH;
  const toPoints = (values: number[]) => values.map((value, index) => [x(index), y(value)] as const);
  const currentPath = smoothPath(toPoints(current));
  const previousPath = smoothPath(toPoints(previous));
  const area = `${currentPath} L ${x(current.length - 1)} ${pad.top + innerH} L ${x(0)} ${pad.top + innerH} Z`;
  const ticks = [0, Math.round(max / 2), max];

  return (
    <div className="relative h-[160px] overflow-hidden md:h-[180px]">
      <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 h-full w-full">
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--chart-grid)"
            />
            <text
              x={pad.left - 6}
              y={y(tick) + 4}
              textAnchor="end"
              fill="var(--text-muted)"
              fontSize="11"
            >
              {tick}
            </text>
          </g>
        ))}
        {labels.map((label, index) => (
          <text
            key={`${label}-${index}`}
            x={x(index)}
            y={height - 6}
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize="11"
          >
            {label}
          </text>
        ))}
        <path d={area} fill="var(--chart-fill)" />
        <path
          d={previousPath}
          fill="none"
          stroke="var(--chart-prev)"
          strokeDasharray="4 5"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d={currentPath} fill="none" stroke="var(--chart-line)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}
