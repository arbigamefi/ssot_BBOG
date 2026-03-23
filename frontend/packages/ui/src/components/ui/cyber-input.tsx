import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const cyberInputGroupVariants = cva(
  "bg-[#020202] shadow-[inset_0_2px_15px_rgba(0,0,0,1)] rounded-2xl p-5 transition-all group border",
  {
    variants: {
      colorVariant: {
        default: "border-white/10 focus-within:border-white/30 focus-within:shadow-[0_0_20px_rgba(255,255,255,0.1),inset_0_2px_15px_rgba(0,0,0,1)]",
        emerald: "border-emerald-500/30 focus-within:border-emerald-400 focus-within:shadow-[0_0_20px_rgba(16,185,129,0.2),inset_0_2px_15px_rgba(0,0,0,1)]",
        purple: "border-purple-500/30 focus-within:border-purple-400 focus-within:shadow-[0_0_20px_rgba(168,85,247,0.2),inset_0_2px_15px_rgba(0,0,0,1)]",
        amber: "border-amber-500/30 focus-within:border-amber-400 focus-within:shadow-[0_0_20px_rgba(245,158,11,0.2),inset_0_2px_15px_rgba(0,0,0,1)]",
        fuchsia: "border-fuchsia-500/30 focus-within:border-fuchsia-400 focus-within:shadow-[0_0_20px_rgba(217,70,239,0.2),inset_0_2px_15px_rgba(0,0,0,1)]",
      },
    },
    defaultVariants: {
      colorVariant: "default",
    },
  }
);

export interface CyberInputGroupProps 
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'color'>,
    VariantProps<typeof cyberInputGroupVariants> {
  label?: string;
  balanceText?: string;
  icon?: React.ReactNode;
  onMaxClick?: () => void;
  maxButtonText?: string;
}

export const CyberInputGroup = React.forwardRef<HTMLInputElement, CyberInputGroupProps>(
  ({ className, colorVariant, label = "Amount", balanceText, icon, onMaxClick, maxButtonText = "MAX", ...props }, ref) => {
    
    // Helper to generate text color classes for labels/icons based on the color variant
    const getTextColor = () => {
      switch (colorVariant) {
        case "emerald": return "text-emerald-500/60 group-focus-within:text-emerald-400";
        case "purple": return "text-purple-500/60 group-focus-within:text-purple-400";
        case "amber": return "text-amber-500/60 group-focus-within:text-amber-400";
        case "fuchsia": return "text-fuchsia-500/60 group-focus-within:text-fuchsia-400";
        default: return "text-white/40 group-focus-within:text-white";
      }
    };

    const getMaxButtonColor = () => {
      switch (colorVariant) {
        case "emerald": return "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
        case "purple": return "bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/30";
        case "amber": return "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30";
        case "fuchsia": return "bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30";
        default: return "bg-white/5 hover:bg-white/10 text-white border-white/10";
      }
    };

    return (
      <div className={cn(cyberInputGroupVariants({ colorVariant, className }))}>
        {(label || balanceText) && (
          <div className="flex justify-between items-center mb-3">
            <span className={cn("text-[10px] font-bold uppercase tracking-widest transition-colors", getTextColor())}>
              {label}
            </span>
            {balanceText && (
              <span className="text-[10px] font-mono font-bold uppercase text-white/50 tracking-widest bg-white/5 px-2 py-0.5 rounded border border-white/10">
                {balanceText}
              </span>
            )}
          </div>
        )}
        <div className="flex items-center gap-4">
          {icon && (
            <div className={cn("transition-colors", getTextColor())}>
              {icon}
            </div>
          )}
          <input 
            ref={ref}
            type="text" 
            className="bg-transparent border-none outline-none text-4xl font-mono font-extrabold text-white w-full placeholder:text-white/10"
            {...props}
          />
          {onMaxClick && (
            <button 
              type="button"
              onClick={onMaxClick}
              className={cn("px-4 py-2 rounded-xl text-xs font-extrabold transition-colors border shadow-[inset_0_2px_5px_rgba(255,255,255,0.1)]", getMaxButtonColor())}
            >
              {maxButtonText}
            </button>
          )}
        </div>
      </div>
    );
  }
);
CyberInputGroup.displayName = "CyberInputGroup";
