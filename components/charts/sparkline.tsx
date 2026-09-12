/** 7-day sparkline for hours logged (developer dashboard). Bars, 4px rounded ends, direct label on the max. */
export function Sparkline({ values, labels, color = "#1470e8", ariaLabel }: { values: number[]; labels: string[]; color?: string; ariaLabel: string }) {
  const max = Math.max(1, ...values);
  const w = 140;
  const h = 40;
  const bw = w / values.length - 4;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-[140px]" role="img" aria-label={`${ariaLabel}: ${values.map((v, i) => `${labels[i]} ${v}`).join(", ")}`}>
      {values.map((v, i) => {
        const bh = Math.max(2, (v / max) * (h - 4));
        return (
          <g key={i}>
            <title>{`${labels[i]}: ${Math.round(v / 6) / 10} h`}</title>
            <rect x={i * (bw + 4)} y={h - bh} width={bw} height={bh} rx={2} fill={v === max && v > 0 ? color : "var(--primary-fixed-dim)"} />
          </g>
        );
      })}
    </svg>
  );
}
