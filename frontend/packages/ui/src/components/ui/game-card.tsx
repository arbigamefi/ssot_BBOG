import * as React from "react";
import { cn } from "../../lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const gameCardGlowVariants = cva(
  "absolute inset-0 bg-gradient-to-b opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none to-transparent",
  {
    variants: {
      colorVariant: {
        emerald: "from-emerald-500/10",
        purple: "from-purple-500/10",
        amber: "from-amber-500/10",
        fuchsia: "from-fuchsia-500/10",
        blue: "from-blue-500/10",
        rose: "from-rose-500/10",
        cyan: "from-cyan-500/10",
      },
    },
    defaultVariants: {
      colorVariant: "emerald",
    },
  }
);

export interface GameCardProps {
  colorVariant: "emerald" | "purple" | "amber" | "fuchsia" | "blue" | "rose" | "cyan";
  title: string;
  promise: string;
  icon: React.ReactNode;
  tag: string;
  liveStatus: string;
  href: string;
  buttonText: string;
  className?: string;
}

export function GameCard({
  colorVariant,
  title,
  promise,
  icon,
  tag,
  liveStatus,
  href,
  buttonText,
  className
}: GameCardProps) {

  const getBorderColorClasses = () => {
    switch(colorVariant) {
      case "emerald": return "border-emerald-500/40";
      case "purple": return "border-purple-500/40";
      case "amber": return "border-amber-500/40";
      case "fuchsia": return "border-fuchsia-500/40";
      case "blue": return "border-blue-500/40";
      case "rose": return "border-rose-500/40";
      case "cyan": return "border-cyan-500/40";
      default: return "border-white/10";
    }
  };

  const getTextGradient = () => {
    switch(colorVariant) {
      case "emerald": return "to-emerald-200";
      case "purple": return "to-purple-200";
      case "amber": return "to-amber-200";
      case "fuchsia": return "to-fuchsia-200";
      case "blue": return "to-blue-200";
      case "rose": return "to-rose-200";
      case "cyan": return "to-cyan-200";
      default: return "to-white";
    }
  };

  const getLiveIndicatorColors = () => {
    switch(colorVariant) {
      case "emerald": return "bg-emerald-500 shadow-[0_0_8px_#10b981]";
      case "purple": return "bg-purple-500 shadow-[0_0_8px_#a855f7]";
      case "amber": return "bg-amber-500 shadow-[0_0_8px_#f59e0b]";
      case "fuchsia": return "bg-fuchsia-500 shadow-[0_0_8px_#d946ef]";
      case "blue": return "bg-blue-500 shadow-[0_0_8px_#3b82f6]";
      case "rose": return "bg-rose-500 shadow-[0_0_8px_#f43f5e]";
      case "cyan": return "bg-cyan-500 shadow-[0_0_8px_#06b6d4]";
      default: return "bg-white shadow-[0_0_8px_white]";
    }
  };

  // Pre-calculate hover background classes for the button, equivalent to the "buttonHover" generation in prototype
  const getButtonHoverClasses = () => {
    switch (colorVariant) {
      case "emerald": return "hover:bg-emerald-500 hover:text-black";
      case "purple": return "hover:bg-purple-500 hover:text-white";
      case "amber": return "hover:bg-amber-500 hover:text-black";
      case "fuchsia": return "hover:bg-fuchsia-500 hover:text-white";
      case "blue": return "hover:bg-blue-500 hover:text-white";
      case "rose": return "hover:bg-rose-500 hover:text-white";
      case "cyan": return "hover:bg-cyan-500 hover:text-black";
      default: return "hover:bg-white hover:text-black";
    }
  };

  return (
    <a 
      href={href} 
      className={cn(
        "group relative rounded-[2rem] border border-white/5 bg-[#050505] overflow-hidden transition-all flex flex-col min-h-[400px] shadow-[inset_0_2px_15px_rgba(255,255,255,0.02),0_20px_40px_rgba(0,0,0,0.8)]",
        className
      )}
    >
      {/* Ambient Hover Gradient */}
      <div className={cn(gameCardGlowVariants({ colorVariant }))} />
      
      {/* Badges area */}
      <div className="absolute top-5 left-5 right-5 flex justify-between items-start z-20 pointer-events-none">
        <div className="px-3 py-1.5 rounded-full bg-[#020202]/90 border border-white/10 shadow-[inset_0_2px_5px_rgba(255,255,255,0.1)] backdrop-blur-md text-[10px] font-bold uppercase tracking-widest text-white/70">
          {tag}
        </div>
        <div className={cn("px-3 py-1.5 rounded-lg bg-[#020202]/90 border shadow-[inset_0_2px_5px_rgba(255,255,255,0.1)] backdrop-blur-md flex items-center gap-2", getBorderColorClasses())}>
            <span className={cn("w-2 h-2 rounded-full animate-pulse", getLiveIndicatorColors())} />
            <span className="text-xs font-mono font-bold text-white tracking-widest">{liveStatus}</span>
        </div>
      </div>

      {/* Center Graphic */}
      <div className="flex-1 p-6 relative z-10 flex items-center justify-center mt-10 group-hover:scale-105 transition-transform duration-500">
        {icon}
      </div>

      {/* Info Card */}
      <div className="p-6 border-t border-white/10 bg-[#0a0a0a]/90 relative z-20 backdrop-blur-xl shadow-[inset_0_2px_15px_rgba(255,255,255,0.05)] pt-8">
        <h3 className={cn("text-2xl font-extrabold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-white", getTextGradient())}>
          {title}
        </h3>
        <p className="text-white/40 text-sm mb-6 h-10 leading-relaxed font-medium">
          {promise}
        </p>
        <div className={cn(
          "w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all shadow-[inset_0_2px_5px_rgba(255,255,255,0.1)] border border-white/10",
          "bg-[#050505] text-white/80 group-hover:shadow-[0_0_30px_rgba(currentColor,0.4),inset_0_2px_5px_rgba(255,255,255,0.5)]",
          getButtonHoverClasses()
        )}>
          {buttonText} {`->`}
        </div>
      </div>
    </a>
  );
}
