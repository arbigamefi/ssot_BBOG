import React from "react";
import { cn } from "../../lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Primary glow color matching the route's theme (e.g. "bg-blue-500") */
  glowColor?: string;
  /** Where to anchor the glow effect */
  glowPosition?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  /** Level of visual padding */
  padding?: "none" | "md" | "lg" | "xl";
}

export function GlassCard({
  children,
  className,
  glowColor,
  glowPosition = "top-right",
  padding = "lg",
  ...props
}: GlassCardProps) {
  
  const getGlowPositionClass = () => {
    switch(glowPosition) {
      case "top-right": return "top-0 right-0";
      case "top-left": return "top-0 left-0";
      case "bottom-right": return "bottom-0 right-0";
      case "bottom-left": return "bottom-0 left-0";
      default: return "top-0 right-0";
    }
  };

  const getPaddingClass = () => {
    switch(padding) {
      case "none": return "p-0";
      case "md": return "p-4 md:p-6";
      case "lg": return "p-6 md:p-8"; 
      case "xl": return "p-8 md:p-12";
      default: return "p-6 md:p-8";
    }
  };

  return (
    <div 
      className={cn(
        "rounded-2xl md:rounded-3xl border border-white/10 bg-[#0a0a0a] relative overflow-hidden flex flex-col shadow-2xl transition-all",
        getPaddingClass(),
        className
      )}
      {...props}
    >
      {glowColor && (
        <div 
          className={cn(
            "absolute w-64 h-64 blur-[80px] -z-10 pointer-events-none opacity-20",
            getGlowPositionClass(),
            glowColor
          )} 
        />
      )}
      {children}
    </div>
  );
}
