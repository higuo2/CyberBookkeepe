import type { HTMLAttributes } from "react";

/** Cream-theme pulse placeholder */
export function Skeleton({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={`animate-pulse bg-[#EAE2D5]/60 ${className.includes("rounded") ? "" : "rounded-2xl"} ${className}`}
      {...props}
    />
  );
}

/** Transaction list loading — 4 soft card rows */
export function TransactionListSkeleton() {
  return (
    <div className="space-y-3 pt-2" role="status" aria-label="Loading">
      {[0, 1, 2, 3].map((i) => (
        <div
          className="rounded-2xl border border-cream-border bg-cream-card p-3.5 shadow-sm"
          key={i}
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className={`h-3.5 ${i % 2 === 0 ? "w-28" : "w-20"}`} />
              <Skeleton className={`h-3 ${i % 2 === 0 ? "w-40" : "w-32"}`} />
            </div>
            <Skeleton className="h-4 w-14 shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Charts section loading — chart block + legend bars */
export function ChartBlockSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div className="mt-3 space-y-3" role="status" aria-label="Loading">
      <Skeleton className={`w-full ${tall ? "h-48" : "h-36"}`} />
      <div className="space-y-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-[92%]" />
        <Skeleton className="h-9 w-[78%]" />
      </div>
    </div>
  );
}
