import * as React from "react";

import { cn } from "../../lib/utils";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export type StakeSpecFormValue = {
  /** Amount per bet (display value, user-typed). */
  amountPerRoll: string;
  /** Number of bets/rolls (display value, user-typed). */
  betCount: string;
  /** Optional stop-gain (display value, user-typed). */
  stopGain?: string;
  /** Optional stop-loss (display value, user-typed). */
  stopLoss?: string;
};

export type StakeSpecFormErrors = Partial<Record<keyof StakeSpecFormValue, string>>;

export type StakeSpecFormProps = {
  value: StakeSpecFormValue;
  onChange: (next: StakeSpecFormValue) => void;
  errors?: StakeSpecFormErrors;
  disabled?: boolean;
  /** Display-only hint shown next to amount fields (e.g., "USDC (6)"). */
  unitHint?: string;
  /** Constraints for betCount input (UI only; enforce in model layer too). */
  betCountMin?: number;
  betCountMax?: number;
  /** Show stop-gain / stop-loss fields. */
  defaultShowAdvanced?: boolean;
  className?: string;
};

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-destructive">{msg}</p>;
}

/**
 * Presentational StakeSpec form.
 *
 * Pure UI: accepts/returns user-typed strings, renders error messages.
 * Parsing/validation/encoding is handled in the feature/model layer.
 */
export function StakeSpecForm(props: StakeSpecFormProps) {
  const {
    value,
    onChange,
    errors,
    disabled,
    unitHint,
    betCountMin = 1,
    betCountMax = 100,
    defaultShowAdvanced = false,
    className,
  } = props;

  const [showAdvanced, setShowAdvanced] = React.useState(defaultShowAdvanced);

  return (
    <div className={cn("space-y-6", className)}>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="stake.amountPerRoll" className="text-sm font-bold tracking-wider text-muted-foreground uppercase">Amount per bet</Label>
          {unitHint ? <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold tracking-widest text-primary border border-primary/20">{unitHint}</span> : null}
        </div>
        <div className="relative">
          <Input
            id="stake.amountPerRoll"
            inputMode="decimal"
            placeholder="0.00"
            value={value.amountPerRoll}
            onChange={(e) => onChange({ ...value, amountPerRoll: e.target.value })}
            disabled={disabled}
            className="text-2xl font-black font-mono tracking-widest h-14 bg-black/60 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] border-white/5 focus-visible:border-primary/50 focus-visible:shadow-[0_0_15px_rgba(16,185,129,0.1)_inset]"
          />
        </div>
        <FieldError msg={errors?.amountPerRoll} />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="stake.betCount" className="text-sm font-bold tracking-wider text-muted-foreground uppercase">Bet count</Label>
          <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold tracking-widest text-white/50 border border-white/10 uppercase">Rolls</span>
        </div>
        <Input
          id="stake.betCount"
          type="number"
          min={betCountMin}
          max={betCountMax}
          step={1}
          placeholder={String(betCountMin)}
          value={value.betCount}
          onChange={(e) => onChange({ ...value, betCount: e.target.value })}
          disabled={disabled}
          className="text-xl font-bold font-mono tracking-widest h-12 bg-black/40 border-white/5 focus-visible:border-white/20"
        />
        <FieldError msg={errors?.betCount} />
      </div>

      <div className="flex items-center justify-center pt-2 border-t border-white/5">
        <button
          type="button"
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors py-2"
          onClick={() => setShowAdvanced((s) => !s)}
          disabled={disabled}
          aria-expanded={showAdvanced}
          aria-controls="stake-spec-advanced"
        >
          {showAdvanced ? "Hide advanced limits" : "Show advanced limits"}
          <svg className={`w-4 h-4 transition-transform duration-300 ${showAdvanced ? "rotate-180 text-primary" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {showAdvanced ? (
        <div id="stake-spec-advanced" className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-black/20 border border-white/5">
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="stake.stopGain" className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Stop gain</Label>
            </div>
            <Input
              id="stake.stopGain"
              inputMode="decimal"
              placeholder="0.00"
              value={value.stopGain ?? ""}
              onChange={(e) => onChange({ ...value, stopGain: e.target.value })}
              disabled={disabled}
              className="font-mono text-sm bg-black/40"
            />
            <FieldError msg={errors?.stopGain} />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="stake.stopLoss" className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Stop loss</Label>
            </div>
            <Input
              id="stake.stopLoss"
              inputMode="decimal"
              placeholder="0.00"
              value={value.stopLoss ?? ""}
              onChange={(e) => onChange({ ...value, stopLoss: e.target.value })}
              disabled={disabled}
              className="font-mono text-sm bg-black/40"
            />
            <FieldError msg={errors?.stopLoss} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
