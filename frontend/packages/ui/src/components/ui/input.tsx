import * as React from "react";

import { cn } from "../../lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

// Minimal shadcn-style Input. Pure presentational.
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "flex h-11 w-full rounded-md border border-border bg-surface-1 px-4 py-2 text-sm text-fg shadow-inner-e1 transition-colors duration-base " +
            "file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-fg-muted " +
            "focus-visible:border-brand/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand " +
            "aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/35 " +
            "disabled:cursor-not-allowed disabled:opacity-50 hover:bg-surface-2",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
