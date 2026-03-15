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
  const { mask, onMaskChange, className } = props;
  
  const selectedNumbers = React.useMemo(() => maskToArray(mask), [mask]);

  return (
    <div className={cn("relative w-full h-full flex flex-col items-center justify-center p-4 md:p-8", className)}>
      {/* Ambient background glow inside the game surface */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[300px] bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none" />
      
      <KenoGrid 
        value={selectedNumbers}
        onSelectionChange={(nums) => onMaskChange?.(arrayToMask(nums))}
      />
    </div>
  );
}
