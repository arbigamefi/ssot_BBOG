import * as React from "react";
import { cn } from "@ssot/ui";

import { overlayZ } from "./z";

export function StickyActionBar({
  children,
  className,
  innerClassName
}: {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <div
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
