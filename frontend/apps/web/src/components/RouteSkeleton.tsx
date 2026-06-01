import * as React from "react";
import { cn } from "@ssot/ui";

/**
 * Shared skeleton primitives for route-level `loading.tsx` files.
 * `bg-skeleton` + `bg-skeleton-size` come from the Tailwind v4 theme and
 * animate via the `animate-shimmer` keyframes. Respects reduced motion via
 * `motion-safe`.
 */
export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-md bg-surface-2 bg-skeleton bg-skeleton-size motion-safe:animate-shimmer",
        className
      )}
    />
  );
}

/** Page-level shell: header band + content grid. Used by most routes. */
export function RouteSkeleton({
  label,
  variant = "default"
}: {
  /** Visually-hidden status label for screen readers. */
  label: string;
  variant?: "default" | "game" | "grid" | "table";
}) {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-6">
      <span className="sr-only" role="status">
        {label}
      </span>

      {/* Header band */}
      <div className="flex flex-col gap-3 border-b border-border-soft pb-6">
        <SkeletonBlock className="h-8 w-48" />
        <SkeletonBlock className="h-4 w-72" />
      </div>

      {variant === "game" && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <SkeletonBlock className="h-[34rem] w-full" />
          <SkeletonBlock className="h-[34rem] w-full" />
        </div>
      )}

      {variant === "grid" && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-56 w-full" />
          ))}
        </div>
      )}

      {variant === "table" && (
        <div className="mt-6 flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-14 w-full" />
          ))}
        </div>
      )}

      {variant === "default" && (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-40 w-full" />
          ))}
        </div>
      )}
    </div>
  );
}
