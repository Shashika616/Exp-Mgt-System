import { cn } from "@/lib/utils";

/** Skeletons match final geometry so nothing jumps (design.md §12.3). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="divide-y divide-outline-variant/40 rounded-lg border border-outline-variant/40 bg-surface-container-lowest">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex h-11 items-center gap-4 px-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}
