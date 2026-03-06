import * as React from "react";

import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export type DiceParamsFormProps = {
  title?: string;
  description?: string;
  cap: string;
  onCapChange?: (cap: string) => void;
  disabled?: boolean;
  error?: string;
  presets?: number[];
  className?: string;
};

export function DiceParamsForm(props: DiceParamsFormProps) {
  const {
    title = "Dice",
    description = "Choose a cap (payout odds depend on cap).",
    cap,
    onCapChange,
    disabled = false,
    error,
    presets = [2, 5, 10, 25, 50, 75, 95],
    className,
  } = props;

  return (
    <Card className={className}>
      <div className="space-y-3 p-4">
        <div className="space-y-1">
          <Label>{title}</Label>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>

        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <Label className="text-xl font-bold tracking-wider text-primary">Win Chance</Label>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-white">{cap}</span>
              <span className="text-sm font-medium text-muted-foreground">%</span>
            </div>
          </div>

          <div className="relative pt-6 pb-2">
            <input
              type="range"
              min="2"
              max="98"
              value={cap}
              disabled={disabled}
              onChange={(e) => onCapChange?.(e.target.value)}
              className="w-full h-2 bg-black/50 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between mt-2 text-xs font-medium text-muted-foreground">
              <span>Riskier (2%)</span>
              <span>Safer (98%)</span>
            </div>
          </div>

          {error ? <p className="text-sm font-medium text-destructive animate-pulse">{error}</p> : null}
        </div>

        {presets.length > 0 ? (
          <div className="grid grid-cols-4 gap-2 pt-4 border-t border-white/5">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                className={`rounded-xl border border-white/10 px-3 py-2 text-sm font-bold transition-all duration-300 hover:border-primary/50 hover:bg-primary/20 ${cap === String(p)
                  ? "bg-primary text-black border-primary shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                  : "bg-black/30 text-muted-foreground hover:text-white"
                  } disabled:opacity-50`}
                disabled={disabled}
                onClick={() => onCapChange?.(String(p))}
              >
                {p}%
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
