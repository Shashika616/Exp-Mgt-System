"use client";
import { useId, useMemo, useState } from "react";

/**
 * Two-series line chart (created vs resolved) as inline SVG — dataviz skill: thin 2px lines, one axis,
 * legend + direct end labels, crosshair tooltip, text in text tokens (never the series colour).
 * Palette validated: #1470e8 / #146b3f (ΔE 25 deutan, PASS).
 */
export type Series = { name: string; color: string; values: number[] };

export function LineChart({ labels, series, height = 200, ariaLabel }: { labels: string[]; series: Series[]; height?: number; ariaLabel: string }) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const w = 640;
  const h = height;
  const pad = { l: 28, r: 56, t: 12, b: 24 };
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const n = labels.length;
  const x = (i: number) => pad.l + (i / Math.max(1, n - 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (h - pad.t - pad.b);
  const paths = useMemo(() => series.map((s) => s.values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")), [series, n, max]); // eslint-disable-line react-hooks/exhaustive-deps
  const ticks = [0, Math.round(max / 2), max];
  const table = (
    <table className="sr-only">
      <caption>{ariaLabel}</caption>
      <thead>
        <tr>
          <th>Day</th>
          {series.map((s) => (
            <th key={s.name}>{s.name}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {labels.map((l, i) => (
          <tr key={l}>
            <td>{l}</td>
            {series.map((s) => (
              <td key={s.name}>{s.values[i]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <figure className="relative">
      <div className="mb-2 flex flex-wrap gap-4" aria-hidden>
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-2 text-body-sm text-on-surface-variant">
            <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={ariaLabel} onMouseLeave={() => setHover(null)} onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width) * w;
        const i = Math.round(((px - pad.l) / (w - pad.l - pad.r)) * (n - 1));
        setHover(Math.max(0, Math.min(n - 1, i)));
      }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="var(--outline-variant)" strokeOpacity={0.6} strokeDasharray={t === 0 ? undefined : "2 4"} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fontFamily="var(--font-heading)" fill="var(--on-surface-variant)">
              {t}
            </text>
          </g>
        ))}
        {[0, Math.floor((n - 1) / 2), n - 1].map((i) => (
          <text key={i} x={x(i)} y={h - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize="11" fontFamily="var(--font-heading)" fill="var(--on-surface-variant)">
            {labels[i]?.slice(5)}
          </text>
        ))}
        {series.map((s, si) => (
          <g key={s.name}>
            <path d={paths[si]} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <text x={x(n - 1) + 8} y={y(s.values[n - 1] ?? 0) + 4} fontSize="11" fontFamily="var(--font-heading)" fontWeight={600} fill="var(--primary)">
              {s.values[n - 1]}
            </text>
          </g>
        ))}
        {hover !== null ? (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={h - pad.b} stroke="var(--outline)" strokeWidth={1} />
            {series.map((s) => (
              <circle key={s.name} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4} fill={s.color} stroke="var(--surface-container-lowest)" strokeWidth={2} />
            ))}
          </g>
        ) : null}
        <clipPath id={id}>
          <rect x={0} y={0} width={w} height={h} />
        </clipPath>
      </svg>
      {hover !== null ? (
        <div className="pointer-events-none absolute top-8 rounded-md bg-inverse-surface px-2.5 py-1.5 text-[12px] text-inverse-on-surface shadow-[var(--shadow-2)]" style={{ left: `${(x(hover) / w) * 100}%`, transform: hover > n / 2 ? "translateX(-110%)" : "translateX(10px)" }} role="status">
          <p className="font-heading font-semibold">{labels[hover]}</p>
          {series.map((s) => (
            <p key={s.name} className="tabular">
              {s.name}: {s.values[hover]}
            </p>
          ))}
        </div>
      ) : null}
      {table}
    </figure>
  );
}
