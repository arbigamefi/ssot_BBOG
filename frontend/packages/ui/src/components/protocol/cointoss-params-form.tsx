import * as React from "react";

import { Card } from "../ui/card";
import { Label } from "../ui/label";

export type CoinTossSide = "heads" | "tails";

export type CoinTossParamsFormProps = {
  title?: string;
  description?: string;
  side: CoinTossSide;
  onSideChange?: (side: CoinTossSide) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
};

export function CoinTossParamsForm(props: CoinTossParamsFormProps) {
  const {
    title = "Coin Toss",
    description = "Choose heads or tails.",
    side,
    onSideChange,
    disabled = false,
    error,
    className,
  } = props;

  return (
    <Card className={className}>
      <div className="space-y-3 p-4">
        <div className="space-y-1">
          <Label>{title}</Label>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 pb-2">
          <button
            type="button"
            className={[
              "relative overflow-hidden rounded-2xl border-2 p-6 transition-all duration-300 flex flex-col items-center justify-center gap-2",
              side === "heads"
                ? "border-primary bg-primary/10 shadow-[0_0_30px_rgba(16,185,129,0.2)] scale-[1.02]"
                : "border-white/5 bg-black/40 hover:bg-black/60 hover:border-white/10"
            ].filter(Boolean).join(" ")}
            disabled={disabled}
            onClick={() => onSideChange?.("heads")}
          >
            <div className={`text-4xl font-black ${side === "heads" ? "text-primary neon-text-primary" : "text-muted-foreground"}`}>
              HEADS
            </div>
          </button>

          <button
            type="button"
            className={[
              "relative overflow-hidden rounded-2xl border-2 p-6 transition-all duration-300 flex flex-col items-center justify-center gap-2",
              side === "tails"
                ? "border-secondary bg-secondary/10 shadow-[0_0_30px_rgba(139,92,246,0.2)] scale-[1.02]"
                : "border-white/5 bg-black/40 hover:bg-black/60 hover:border-white/10"
            ].filter(Boolean).join(" ")}
            disabled={disabled}
            onClick={() => onSideChange?.("tails")}
          >
            <div className={`text-4xl font-black ${side === "tails" ? "text-secondary neon-text-secondary" : "text-muted-foreground"}`}>
              TAILS
            </div>
          </button>
        </div>

        {error ? <p className="text-sm font-medium text-destructive animate-pulse mt-4">{error}</p> : null}
      </div>
    </Card>
  );
}
