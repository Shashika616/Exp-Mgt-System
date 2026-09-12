/**
 * Status distribution bar (developer load board). Status colours are reserved and always paired with
 * a legend + direct count labels + tooltips - never colour alone (dataviz non-negotiables).
 */
export type Segment = { key: string; label: string; value: number; color: string };

export function StackedBar({ segments, ariaLabel, height = 10 }: { segments: Segment[]; ariaLabel: string; height?: number }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (total === 0) return <div className="h-2.5 rounded-sm bg-surface-container-high" role="img" aria-label={`${ariaLabel}: none`} />;
  return (
    <div className="flex w-full gap-0.5" role="img" aria-label={`${ariaLabel}: ${segments.filter((s) => s.value).map((s) => `${s.label} ${s.value}`).join(", ")}`} style={{ height }}>
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <div key={s.key} className="relative min-w-1.5 rounded-sm" style={{ flex: s.value, background: s.color }} title={`${s.label}: ${s.value}`}>
            {s.value / total > 0.18 ? <span className="tabular absolute inset-0 flex items-center justify-center text-[9px] font-semibold leading-none text-white">{s.value}</span> : null}
          </div>
        ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
