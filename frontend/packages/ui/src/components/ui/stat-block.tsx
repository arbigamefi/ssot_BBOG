import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const statBlockVariants = cva(
  "p-6 rounded-[1.5rem] bg-[#020202] transition-all relative overflow-hidden group border",
  {
    variants: {
      colorVariant: {
        default: "border-white/10 shadow-[inset_0_2px_15px_rgba(255,255,255,0.02)] hover:border-white/30 hover:shadow-[0_0_30px_rgba(255,255,255,0.05),inset_0_2px_15px_rgba(255,255,255,0.05)]",
        emerald: "border-emerald-500/20 shadow-[inset_0_2px_15px_rgba(16,185,129,0.05)] hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.1),inset_0_2px_15px_rgba(16,185,129,0.05)]",
        blue: "border-blue-500/20 shadow-[inset_0_2px_15px_rgba(59,130,246,0.05)] hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.1),inset_0_2px_15px_rgba(59,130,246,0.05)]",
        amber: "border-amber-500/20 shadow-[inset_0_2px_15px_rgba(245,158,11,0.05)] hover:border-amber-500/50 hover:shadow-[0_0_30px_rgba(245,158,11,0.1),inset_0_2px_15px_rgba(245,158,11,0.05)]",
        purple: "border-purple-500/20 shadow-[inset_0_2px_15px_rgba(168,85,247,0.05)] hover:border-purple-500/50 hover:shadow-[0_0_30px_rgba(168,85,247,0.1),inset_0_2px_15px_rgba(168,85,247,0.05)]",
        fuchsia: "border-fuchsia-500/20 shadow-[inset_0_2px_15px_rgba(217,70,239,0.05)] hover:border-fuchsia-500/50 hover:shadow-[0_0_30px_rgba(217,70,239,0.1),inset_0_2px_15px_rgba(217,70,239,0.05)]",
        rose: "border-rose-500/20 shadow-[inset_0_2px_15px_rgba(244,63,94,0.05)] hover:border-rose-500/50 hover:shadow-[0_0_30px_rgba(244,63,94,0.1),inset_0_2px_15px_rgba(244,63,94,0.05)]",
      },
    },
    defaultVariants: {
      colorVariant: "default",
    },
  }
);

export interface StatBlockProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>, VariantProps<typeof statBlockVariants> {
  title: React.ReactNode;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
}

export const StatBlock = React.forwardRef<HTMLDivElement, StatBlockProps>(
  ({ className, colorVariant, title, value, subtitle, icon, ...props }, ref) => {
    
    // Abstract the highly specific glow logic per variant
    const getGlowStyles = () => {
      switch (colorVariant) {
        case "emerald": return "bg-emerald-500/5";
        case "blue": return "bg-blue-500/5";
        case "amber": return "bg-amber-500/5";
        case "purple": return "bg-purple-500/5";
        case "fuchsia": return "bg-fuchsia-500/5";
        case "rose": return "bg-rose-500/5";
        default: return "bg-white/5";
      }
    };

    const getIconStyles = () => {
      switch (colorVariant) {
        case "emerald": return "text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]";
        case "blue": return "text-blue-400 drop-shadow-[0_0_5px_rgba(59,130,246,0.8)]";
        case "amber": return "text-amber-400 drop-shadow-[0_0_5px_rgba(245,158,11,0.8)]";
        case "purple": return "text-purple-400 drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]";
        case "fuchsia": return "text-fuchsia-400 drop-shadow-[0_0_5px_rgba(217,70,239,0.8)]";
        case "rose": return "text-rose-400 drop-shadow-[0_0_5px_rgba(244,63,94,0.8)]";
        default: return "text-white/60 drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]";
      }
    };

    return (
      <div ref={ref} className={cn(statBlockVariants({ colorVariant, className }))} {...props}>
        {/* Abstracted Corner Glow */}
        <div className={cn("absolute top-0 right-0 w-32 h-32 blur-[50px] rounded-full pointer-events-none", getGlowStyles())} />
        
        {icon && (
          <div className={getIconStyles()}>
            {icon}
          </div>
        )}
        
        <div className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1 relative z-10 mt-4">
          {title}
        </div>
        
        <div className="text-3xl font-mono font-bold text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.2)] relative z-10 cursor-default">
          {value}
        </div>
        
        {subtitle && (
          <div className="mt-3 text-xs text-white/40 font-medium relative z-10">
            {subtitle}
          </div>
        )}
      </div>
    );
  }
);
StatBlock.displayName = "StatBlock";
