import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONE_CLASS, TONE_DOT, type Tone } from "@/lib/design/status";

// docs/design.md §7.3 - never colour-only: dot or icon + text.
export function Badge({ tone = "neutral", icon: Icon, dot, children, className, title }: { tone?: Tone; icon?: LucideIcon; dot?: boolean; children: React.ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-overline", TONE_CLASS[tone], className)}>
      {dot ? <span className={cn("size-1.5 rounded-full", TONE_DOT[tone])} aria-hidden /> : null}
      {Icon ? <Icon className="size-3.5" strokeWidth={1.75} aria-hidden /> : null}
      {children}
    </span>
  );
}

export function Chip({ tone = "neutral", icon: Icon, children, className }: { tone?: Tone; icon?: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 text-[11px] font-medium font-heading", TONE_CLASS[tone], className)}>
      {Icon ? <Icon className="size-3" strokeWidth={1.75} aria-hidden /> : null}
      {children}
    </span>
  );
}
