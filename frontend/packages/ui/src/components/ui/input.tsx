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
          "flex h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-base shadow-inner transition-all duration-300 " +
          "file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/60 " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary/50 " +
          "disabled:cursor-not-allowed disabled:opacity-50 hover:bg-black/60",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
