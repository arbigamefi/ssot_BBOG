import React from "react";
import { cn } from "../../lib/utils";

interface ShellHeaderProps {
  className?: string;
  children?: React.ReactNode;
  /**
   * If true, uses a completely transparent background (good for Hero sections).
   * If false, defaults to the standard tokenized top bar.
   */
  variant?: "solid" | "transparent";
}

export function ShellHeader({ className, children, variant = "solid" }: ShellHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-50 flex-shrink-0 transition-colors duration-300",
        variant === "solid"
          ? "border-b border-border bg-surface-0/80 backdrop-blur-md"
          : "border-transparent bg-transparent",
        className
      )}
    >
      <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-6">
        {children}
      </div>
    </header>
  );
}

// ----------------------------------------------------------------------
// Compose Helpers

interface ShellHeaderBrandProps {
  name?: string;
  className?: string;
}
export function ShellHeaderBrand({ name = "ArbiGameFi", className }: ShellHeaderBrandProps) {
  return <div className={cn("text-xl font-bold tracking-tight text-fg", className)}>{name}</div>;
}

interface ShellHeaderNavProps {
  children?: React.ReactNode;
}
export function ShellHeaderNav({ children }: ShellHeaderNavProps) {
  return (
    <nav className="hidden items-center gap-6 text-sm font-medium text-fg-muted md:flex">
      {children}
    </nav>
  );
}

interface ShellHeaderActionsProps {
  children?: React.ReactNode;
}
export function ShellHeaderActions({ children }: ShellHeaderActionsProps) {
  return <div className="flex items-center gap-4">{children}</div>;
}
