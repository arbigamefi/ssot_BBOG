import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-brand/30 bg-brand-soft text-brand",
        secondary: "border-border bg-surface-2 text-fg-muted",
        destructive: "border-danger/30 bg-danger-soft text-danger",
        outline: "border-border bg-transparent text-fg",
        muted: "border-border-soft bg-surface-2 text-fg-subtle"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
