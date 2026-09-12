import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** design.md §7.5 - 24px icon, headline-sm, one sentence, one primary button. */
export function EmptyState({ icon: Icon, title, body, action, className }: { icon: LucideIcon; title: string; body: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-outline-variant px-6 py-12 text-center", className)}>
      <Icon className="size-6 text-on-surface-variant" strokeWidth={1.5} aria-hidden />
      <h3 className="text-headline-sm">{title}</h3>
      <p className="text-body-md max-w-sm text-on-surface-variant">{body}</p>
      {action}
    </div>
  );
}
