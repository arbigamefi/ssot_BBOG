import * as React from "react";
import { cn } from "../../lib/utils";
import { KenoGrid } from "./keno-grid";

export type KenoParamsFormProps = {
  title?: string;
  description?: string;
  mask: string;
  onMaskChange?: (mask: string) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
  variant?: "default" | "prototype";
};

export function arrayToMask(nums: number[]): string {
  if (nums.length === 0) return "0";
  return nums.reduce((acc, num) => acc | (1n << BigInt(num - 1)), 0n).toString(10);
}

export function maskToArray(mask: string): number[] {
  try {
    const m = BigInt(mask);
    const nums: number[] = [];
    for (let i = 0; i < 40; i++) {
      if ((m & (1n << BigInt(i))) !== 0n) {
        nums.push(i + 1);
      }
    }
    return nums;
  } catch {
    return [];
  }
}

export function KenoParamsForm(props: KenoParamsFormProps) {
  const { mask, onMaskChange, className, error, variant = "default" } = props;

  const selectedNumbers = React.useMemo(() => maskToArray(mask), [mask]);
  const isPrototypeVariant = variant === "prototype";

  if (isPrototypeVariant) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="relative flex min-h-[640px] flex-col overflow-hidden rounded-[2.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,13,24,0.98),rgba(4,7,13,0.98))] px-5 pb-8 pt-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:px-8">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-[30%] h-[380px] w-[380px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:linear-gradient(to_top,black,transparent)]" />
          </div>

          <div className="relative z-10 mb-5 flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Packed board
              </div>
              <div className="mt-1 text-base font-semibold text-white">
                {selectedNumbers.length} spot{selectedNumbers.length === 1 ? "" : "s"} active
              </div>
            </div>
            <div className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
              Mask {mask}
            </div>
          </div>

          <div className="relative z-10 flex flex-1 items-center justify-center overflow-x-auto">
            <div className="min-w-[360px]">
              <KenoGrid
                value={selectedNumbers}
                onSelectionChange={(nums) => onMaskChange?.(arrayToMask(nums))}
              />
            </div>
          </div>
        </div>

        {error ? <p className="text-sm font-medium text-rose-300">{error}</p> : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative w-full h-full flex flex-col items-center justify-center p-4 md:p-8",
        className
      )}
    >
      {/* Ambient background glow inside the game surface */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[300px] bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none" />

      <KenoGrid
        value={selectedNumbers}
        onSelectionChange={(nums) => onMaskChange?.(arrayToMask(nums))}
      />

      {error ? <p className="mt-4 text-sm font-medium text-rose-300">{error}</p> : null}
    </div>
  );
}
