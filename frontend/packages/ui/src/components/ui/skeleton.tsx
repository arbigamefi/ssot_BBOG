import * as React from "react";
import { cn } from "../../lib/utils";

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Loading skeleton placeholder.
 *
 * Use to indicate content that is still loading.
 * Renders as a pulsing rounded rectangle.
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      aria-hidden="true"
      {...props}
    />
  );
}

/** Common skeleton presets for re-use across page clients. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3 p-4">
      <Skeleton className="h-5 w-2/5" />
      <Skeleton className="h-3 w-1/3" />
      <div className="space-y-2 pt-2">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonMetric() {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-16" />
    </div>
  );
}
