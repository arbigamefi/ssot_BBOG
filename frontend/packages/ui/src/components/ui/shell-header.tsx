import React from "react";
import { cn } from "../../lib/utils";

interface ShellHeaderProps {
  className?: string;
  children?: React.ReactNode;
  /** 
   * If true, uses a completely transparent background (good for Hero sections).
   * If false, defaults to the standard #050505/80 backdrop-blur top bar.
   */
  variant?: "solid" | "transparent";
}

export function ShellHeader({ 
  className, 
  children,
  variant = "solid"
}: ShellHeaderProps) {
  return (
    <header 
      className={cn(
        "flex-shrink-0 z-50 sticky top-0 transition-colors duration-300",
        variant === "solid" 
          ? "border-b border-white/5 bg-[#050505]/80 backdrop-blur-md" 
          : "bg-transparent border-transparent",
        className
      )}
    >
      <div className="max-w-[1440px] mx-auto px-6 h-20 flex items-center justify-between">
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
  return (
    <div className={cn("text-xl font-bold tracking-tight", className)}>
      {name}
    </div>
  );
}

interface ShellHeaderNavProps {
  children?: React.ReactNode;
}
export function ShellHeaderNav({ children }: ShellHeaderNavProps) {
  return (
    <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-white/60">
      {children}
    </nav>
  );
}

interface ShellHeaderActionsProps {
  children?: React.ReactNode;
}
export function ShellHeaderActions({ children }: ShellHeaderActionsProps) {
  return (
    <div className="flex items-center gap-4">
      {children}
    </div>
  );
}
