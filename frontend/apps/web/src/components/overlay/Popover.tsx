"use client";

import * as React from "react";
import { cn } from "@ssot/ui";

import { overlayZ } from "./z";

export function Popover({
  align = "end",
  ariaLabel,
  children,
  className,
  open,
  placement = "above",
  role = "menu"
}: {
  align?: "end" | "start";
  ariaLabel?: string;
  children: React.ReactNode;
  className?: string;
  open: boolean;
  placement?: "above" | "below";
  role?: "dialog" | "menu";
}) {
  if (!open) return null;

  return (
    <div
      role={role}
      aria-label={ariaLabel}
      className={cn(
        "absolute hidden w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border-soft bg-surface-1 p-1 text-left shadow-e3 md:block",
        align === "start" ? "left-0" : "right-0",
        placement === "above" ? "bottom-full mb-2" : "top-full mt-2",
        overlayZ.popover,
        className
      )}
    >
      {children}
    </div>
  );
}
