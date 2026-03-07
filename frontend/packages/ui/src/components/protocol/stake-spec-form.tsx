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
  amountActions?: Array<{
    label: string;
    onClick: () => void;
    disabled?: boolean;
  }>;
  betCountPresets?: number[];
  balanceHint?: string;
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
    amountActions = [],
    betCountPresets = [1, 3, 5, 10],
    balanceHint,
    className,
  } = props;

  const [showAdvanced, setShowAdvanced] = React.useState(defaultShowAdvanced);

  const updateBetCount = React.useCallback(
    (nextValue: number) => {
      const bounded = Math.max(betCountMin, Math.min(betCountMax, nextValue));
      onChange({ ...value, betCount: String(bounded) });
    },
    [betCountMax, betCountMin, onChange, value]
  );

  const numericBetCount = React.useMemo(() => {
    const parsed = Number(value.betCount || "");
    if (!Number.isFinite(parsed)) return betCountMin;
    return Math.max(betCountMin, Math.min(betCountMax, Math.floor(parsed)));
  }, [betCountMax, betCountMin, value.betCount]);

  return (
    <div className={cn("space-y-6", className)}>
      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="stake.amountPerRoll" className="text-sm font-bold tracking-wider text-muted-foreground uppercase">
              Bet amount
            </Label>
            {balanceHint ? <div className="text-xs text-muted-foreground">{balanceHint}</div> : null}
          </div>
          {unitHint ? (
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-bold tracking-widest text-primary">
              {unitHint}
            </span>
          ) : null}
        </div>
        <div className="relative">
          <Input
            id="stake.amountPerRoll"
            inputMode="decimal"
            placeholder="0.00"
            value={value.amountPerRoll}
            onChange={(e) => onChange({ ...value, amountPerRoll: e.target.value })}
            disabled={disabled}
            className="h-16 rounded-2xl border-white/10 bg-black/60 text-3xl font-black tracking-tight shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] focus-visible:border-primary/50 focus-visible:shadow-[0_0_15px_rgba(16,185,129,0.1)_inset]"
          />
        </div>
        {amountActions.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {amountActions.map((action) => (
              <button
                key={action.label}
                type="button"
                disabled={disabled || action.disabled}
                onClick={action.onClick}
                className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold text-white transition-colors hover:border-white/20 hover:bg-black/50 disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
        <FieldError msg={errors?.amountPerRoll} />
      </div>

      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="stake.betCount" className="text-sm font-bold tracking-wider text-muted-foreground uppercase">
            Number of bets
          </Label>
          <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-bold tracking-widest text-white/50 uppercase">
            Rounds
          </span>
        </div>
        <div className="grid grid-cols-[56px_minmax(0,1fr)_56px] gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateBetCount(numericBetCount - 1)}
            className="rounded-2xl border border-white/10 bg-black/30 text-2xl font-bold text-white transition-colors hover:border-white/20 hover:bg-black/50 disabled:opacity-50"
          >
            -
          </button>
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
            className="h-14 rounded-2xl border-white/10 bg-black/40 text-center text-2xl font-black tracking-tight focus-visible:border-white/20"
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateBetCount(numericBetCount + 1)}
            className="rounded-2xl border border-white/10 bg-black/30 text-2xl font-bold text-white transition-colors hover:border-white/20 hover:bg-black/50 disabled:opacity-50"
          >
            +
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {betCountPresets.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              onClick={() => updateBetCount(preset)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
                numericBetCount === preset
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/20 hover:text-white"
              )}
            >
              x{preset}
            </button>
          ))}
        </div>
        <FieldError msg={errors?.betCount} />
      </div>

      <div className="flex items-center justify-center border-t border-white/5 pt-2">
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
        <div id="stake-spec-advanced" className="grid grid-cols-1 gap-4 rounded-2xl border border-white/5 bg-black/20 p-4 md:grid-cols-2">
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="stake.stopGain" className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Stop gain
              </Label>
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
              <Label htmlFor="stake.stopLoss" className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Stop loss
              </Label>
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
