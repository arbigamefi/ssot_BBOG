import React from "react";
import { cn } from "../../lib/utils";

interface ShellHeaderProps {
  className?: string;
  children?: React.ReactNode;
  sticky?: boolean;
  /**
   * If true, uses a completely transparent background (good for Hero sections).
   * If false, defaults to the standard tokenized top bar.
   */
  variant?: "solid" | "transparent";
}

export function ShellHeader({
  className,
  children,
  sticky = true,
  variant = "solid"
}: ShellHeaderProps) {
  return (
    <header
      className={cn(
        "z-50 shrink-0 transition-colors duration-base",
        sticky ? "sticky top-0" : "relative",
        variant === "solid"
          ? "border-b border-border bg-surface-0/95 supports-[backdrop-filter]:bg-surface-0/80 supports-[backdrop-filter]:backdrop-blur-md"
          : "border-transparent bg-transparent",
        className
      )}
    >
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4 sm:h-16 sm:px-6 md:h-20">
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
  className?: string;
  children?: React.ReactNode;
}
export function ShellHeaderNav({ className, children }: ShellHeaderNavProps) {
  return (
    <nav
      className={cn(
        "hidden min-w-0 items-center gap-6 overflow-x-auto whitespace-nowrap [word-break:keep-all] text-sm font-medium text-fg-muted md:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {children}
    </nav>
  );
}

interface ShellHeaderActionsProps {
  children?: React.ReactNode;
}
export function ShellHeaderActions({ children }: ShellHeaderActionsProps) {
  return <div className="flex shrink-0 items-center gap-2 sm:gap-4">{children}</div>;
}
