"use client";

import * as React from "react";
import { cn } from "@ssot/ui";

import { overlayZ, stickyActionHeightVar } from "./z";

export function StickyActionBar({
  children,
  className,
  innerClassName,
  ariaLabel
}: {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  ariaLabel?: string;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);

  // Publish the bar's live height so bottom-anchored banners can sit above it
  // instead of covering the primary mobile CTA. Cleaned up on unmount.
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty(stickyActionHeightVar, `${el.offsetHeight}px`);
    publish();
    if (typeof ResizeObserver === "undefined") {
      return () => root.style.removeProperty(stickyActionHeightVar);
    }
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty(stickyActionHeightVar);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-label={ariaLabel}
      role={ariaLabel ? "region" : undefined}
      className={cn(
        "fixed inset-x-0 bottom-0 border-t border-border bg-surface-2/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-e3 backdrop-blur lg:hidden",
        overlayZ.stickyAction,
        className
      )}
    >
      <div className={cn("mx-auto max-w-md", innerClassName)}>{children}</div>
    </div>
  );
}
