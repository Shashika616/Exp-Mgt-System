import Link from "next/link";
import { cn } from "@/lib/utils";

/** Stat tile (dataviz "hero number"): label, tabular value, muted unit; every tile links to the filtered list. */
export function StatTile({ label, value, unit, href, tone, hint }: { label: string; value: string | number; unit?: string; href?: string; tone?: "danger" | "warning" | "success" | "info"; hint?: string }) {
  const inner = (
    <div className={cn("flex h-[96px] flex-col justify-between rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-[var(--shadow-1)] transition-shadow", href && "soft-lift-hover")}>
      <p className="text-overline text-on-surface-variant">{label}</p>
      <p className="flex items-baseline gap-1.5">
        <span className={cn("tabular font-heading text-[28px] font-bold leading-none tracking-[-0.015em] text-primary", tone === "danger" && "text-danger-fg", tone === "warning" && "text-warning-fg", tone === "success" && "text-success-fg")}>{value}</span>
        {unit ? <span className="text-body-sm text-on-surface-variant">{unit}</span> : null}
        {hint ? <span className="text-body-sm ml-auto text-on-surface-variant">{hint}</span> : null}
      </p>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-secondary-container">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function fmtMinutes(min: number | null | undefined): string {
  if (min == null) return "—";
  if (min < 60) return `${min}m`;
  const h = Math.round((min / 60) * 10) / 10;
  return h < 48 ? `${h}h` : `${Math.round((h / 24) * 10) / 10}d`;
}
