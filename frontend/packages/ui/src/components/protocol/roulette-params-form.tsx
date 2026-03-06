import * as React from "react";

import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export type RouletteParamsFormProps = {
  title?: string;
  description?: string;
  /** Bitmask (uint40) as user-typed string. Accepts hex (0x...) or decimal. */
  mask: string;
  onMaskChange?: (mask: string) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
};

export function RouletteParamsForm(props: RouletteParamsFormProps) {
  const {
    title = "Roulette",
    description = "Enter a uint40 bitmask of selected numbers.",
    mask,
    onMaskChange,
    disabled = false,
    error,
    className,
  } = props;

  return (
    <Card className={className}>
      <div className="space-y-3 p-4">
        <div className="space-y-1 border-b border-white/5 pb-4">
          <Label className="text-2xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
            {title}
          </Label>
          {description ? <p className="text-sm font-medium text-muted-foreground/80">{description}</p> : null}
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-bold tracking-wider text-muted-foreground uppercase">Number Mask</Label>
            <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold tracking-widest text-primary border border-primary/20">UINT40</span>
          </div>
          <Input
            inputMode="text"
            placeholder="e.g. 0x12345"
            value={mask}
            disabled={disabled}
            onChange={(e) => onMaskChange?.(e.target.value)}
            className="text-center text-xl font-mono tracking-wider font-bold text-primary placeholder:text-muted-foreground/30 h-14 bg-black/60 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] border-white/5 focus-visible:border-primary/50 focus-visible:shadow-[0_0_15px_rgba(16,185,129,0.1)_inset]"
          />
          <p className="text-xs text-muted-foreground/60 text-center">
            Accepts hex (<span className="font-mono text-muted-foreground/80">0x...</span>) or decimal values.
          </p>
          {error ? <p className="text-sm font-bold text-destructive animate-pulse text-center">{error}</p> : null}
        </div>
      </div>
    </Card>
  );
}
