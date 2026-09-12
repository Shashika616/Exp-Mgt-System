import { TableSkeleton } from "@/components/ui/skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mt-6 h-10 w-full" />
      <div className="mt-4">
        <TableSkeleton rows={10} />
      </div>
    </div>
  );
}
