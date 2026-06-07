"use client";

import * as React from "react";
import { cn } from "@ssot/ui";

import { overlayZ } from "./z";

export function Popover({
  children,
  className,
  open,
  role = "menu"
}: {
  children: React.ReactNode;
  className?: string;
  open: boolean;
  role?: "dialog" | "menu";
}) {
  if (!open) return null;

  return (
    <div
      role={role}
      className={cn(
        "absolute bottom-full right-0 mb-2 hidden w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border-soft bg-surface-1 p-1 text-left shadow-e3 md:block",
        overlayZ.popover,
        className
      )}
    >
      {children}
    </div>
  );
}
