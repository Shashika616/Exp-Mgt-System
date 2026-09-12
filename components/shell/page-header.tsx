import { cn } from "@/lib/utils";

/** Title + count + one primary action (design.md §8.4 "what's here"). */
export function PageHeader({ title, count, description, action, className }: { title: string; count?: number; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        <h1 className="text-headline-lg flex items-baseline gap-2">
          {title}
          {count !== undefined ? <span className="tabular text-headline-sm font-medium text-on-surface-variant">{count}</span> : null}
        </h1>
        {description ? <p className="text-body-md mt-1 text-on-surface-variant">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
