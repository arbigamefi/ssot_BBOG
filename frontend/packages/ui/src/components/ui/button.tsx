import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-brand text-fg-inverse shadow-glow hover:bg-brand-hover",
        secondary: "border border-border bg-surface-2 text-fg hover:bg-surface-3",
        outline:
          "border border-border bg-transparent text-fg hover:border-brand/40 hover:bg-brand-soft",
        destructive: "bg-danger text-fg-inverse hover:bg-danger/90",
        ghost: "text-fg-muted hover:bg-surface-2 hover:text-fg",
        glass: "border border-border bg-surface-1/80 text-fg backdrop-blur-md hover:bg-surface-2",
        link: "text-brand underline-offset-4 hover:underline"
      },
      size: {
        default: "h-12 px-6 py-2 tracking-wide",
        sm: "h-10 rounded-xl px-4 text-sm",
        lg: "h-14 px-10 text-lg uppercase tracking-wider",
        icon: "h-12 w-12"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";
