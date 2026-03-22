import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const cyberButtonVariants = cva(
  "inline-flex w-full items-center justify-center gap-2 transition-all active:scale-[0.98] pointer-events-auto",
  {
    variants: {
      variant: {
        default: "bg-white hover:bg-white/90 text-black font-extrabold shadow-[0_0_30px_rgba(255,255,255,0.2),inset_0_2px_4px_rgba(255,255,255,0.6)] border border-white/80",
        emerald: "bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold shadow-[0_0_30px_rgba(16,185,129,0.4),inset_0_2px_4px_rgba(255,255,255,0.6)] border border-emerald-300",
        purple: "bg-purple-500 hover:bg-purple-400 text-white font-extrabold shadow-[0_0_30px_rgba(168,85,247,0.4),inset_0_2px_4px_rgba(255,255,255,0.4)] border border-purple-300",
        amber: "bg-amber-500 hover:bg-amber-400 text-black font-extrabold shadow-[0_0_30px_rgba(245,158,11,0.4),inset_0_2px_4px_rgba(255,255,255,0.6)] border border-amber-300",
        fuchsia: "bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-extrabold shadow-[0_0_30px_rgba(217,70,239,0.4),inset_0_2px_4px_rgba(255,255,255,0.4)] border border-fuchsia-300",
        outline: "bg-transparent text-white font-bold border border-white/10 hover:bg-white/5 hover:border-white/20 shadow-[inset_0_2px_5px_rgba(255,255,255,0.1)]",
        danger: "bg-rose-500 hover:bg-rose-400 text-white font-extrabold shadow-[0_0_30px_rgba(244,63,94,0.4),inset_0_2px_4px_rgba(255,255,255,0.4)] border border-rose-300",
      },
      size: {
        default: "h-12 px-6 py-2 rounded-xl text-md",
        sm: "h-9 px-4 rounded-lg text-sm",
        lg: "py-5 rounded-2xl text-lg",
        icon: "h-12 w-12 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface CyberButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof cyberButtonVariants> {
  asChild?: boolean;
}

const CyberButton = React.forwardRef<HTMLButtonElement, CyberButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(cyberButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
CyberButton.displayName = "CyberButton";

export { CyberButton, cyberButtonVariants };
