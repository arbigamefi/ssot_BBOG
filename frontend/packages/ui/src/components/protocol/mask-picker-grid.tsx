import * as React from "react";

import { cn } from "../../lib/utils";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export type MaskPickerCell = {
  label: string;
  className?: string;
};

export type MaskPickerGridProps = {
  title?: string;
  description?: string;
  mask: string;
  onMaskChange?: (mask: string) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
  cells?: MaskPickerCell[];
  helperText?: string;
  minSelections?: number;
  maxSelections?: number;
  quickPickCounts?: number[];
  rawMaskLabel?: string;
};

const DEFAULT_CELL_COUNT = 40;
const MAX_MASK = (1n << 40n) - 1n;

function parseMask(mask: string): bigint | null {
  const raw = mask.trim();
  if (!raw) return 0n;
  try {
    const parsed = BigInt(raw);
    if (parsed < 0n || parsed > MAX_MASK) return null;
    return parsed;
  } catch {
    return null;
  }
}

function formatMask(mask: bigint) {
  return `0x${mask.toString(16)}`;
}

function countBits(mask: bigint, count: number) {
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    if ((mask & (1n << BigInt(index))) !== 0n) total += 1;
  }
  return total;
}

function selectedIndices(mask: bigint, count: number) {
  const result: number[] = [];
  for (let index = 0; index < count; index += 1) {
    if ((mask & (1n << BigInt(index))) !== 0n) result.push(index);
  }
  return result;
}

function buildRandomMask(cellCount: number, pickCount: number) {
  const pool = Array.from({ length: cellCount }, (_value, index) => index);
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = pool[index] ?? 0;
    const swap = pool[swapIndex] ?? 0;
    pool[index] = swap;
    pool[swapIndex] = current;
  }

  let next = 0n;
  pool.slice(0, pickCount).forEach((index) => {
    next |= 1n << BigInt(index);
  });
  return next;
}

export function MaskPickerGrid({
  title = "Selection board",
  description,
  mask,
  onMaskChange,
  disabled = false,
  error,
  className,
  cells,
  helperText,
  minSelections = 1,
  maxSelections,
  quickPickCounts = [1, 5, 10],
  rawMaskLabel = "Advanced raw mask",
}: MaskPickerGridProps) {
  const resolvedCells = React.useMemo<MaskPickerCell[]>(
    () =>
      cells && cells.length > 0
        ? cells.slice(0, DEFAULT_CELL_COUNT)
        : Array.from({ length: DEFAULT_CELL_COUNT }, (_value, index) => ({ label: String(index + 1) })),
    [cells]
  );

  const parsedMask = React.useMemo(() => parseMask(mask), [mask]);
  const safeMask = parsedMask ?? 0n;
  const activeCount = React.useMemo(() => countBits(safeMask, resolvedCells.length), [resolvedCells.length, safeMask]);
  const activeIndices = React.useMemo(
    () => selectedIndices(safeMask, resolvedCells.length),
    [resolvedCells.length, safeMask]
  );

  const selectionPreview = React.useMemo(() => {
    if (activeIndices.length === 0) return "Nothing selected yet.";
    const labels = activeIndices.slice(0, 8).map((index) => resolvedCells[index]?.label ?? String(index + 1));
    const extra = activeIndices.length - labels.length;
    return extra > 0 ? `${labels.join(", ")} +${extra} more` : labels.join(", ");
  }, [activeIndices, resolvedCells]);

  const emitMask = React.useCallback(
    (next: bigint) => {
      onMaskChange?.(formatMask(next));
    },
    [onMaskChange]
  );

  const toggleCell = React.useCallback(
    (index: number) => {
      const bit = 1n << BigInt(index);
      const isActive = (safeMask & bit) !== 0n;
      if (!isActive && typeof maxSelections === "number" && activeCount >= maxSelections) return;
      emitMask(isActive ? safeMask & ~bit : safeMask | bit);
    },
    [activeCount, emitMask, maxSelections, safeMask]
  );

  const applyQuickPick = React.useCallback(
    (count: number) => {
      const targetCount = Math.max(minSelections, Math.min(maxSelections ?? count, count, resolvedCells.length));
      emitMask(buildRandomMask(resolvedCells.length, targetCount));
    },
    [emitMask, maxSelections, minSelections, resolvedCells.length]
  );

  return (
    <div className={cn("space-y-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Selection board</div>
          <div className="text-2xl font-black tracking-tight text-white">{title}</div>
          {description ? <p className="max-w-2xl text-sm leading-6 text-slate-400">{description}</p> : null}
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 px-5 py-4 text-right">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Selected</div>
          <div className="mt-2 text-4xl font-black text-white">{activeCount}</div>
          <div className="mt-1 text-xs text-slate-400">
            {typeof maxSelections === "number"
              ? `Pick ${minSelections}-${maxSelections} cells`
              : `Pick at least ${minSelections} cell${minSelections === 1 ? "" : "s"}`}
          </div>
        </div>
      </div>

      <div className="rounded-[1.85rem] border border-violet-400/15 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.18),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.94),rgba(8,12,24,0.98))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-5">
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {resolvedCells.map((cell, index) => {
            const active = (safeMask & (1n << BigInt(index))) !== 0n;
            return (
              <button
                key={`${cell.label}-${index}`}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                onClick={() => toggleCell(index)}
                className={cn(
                  "flex h-14 items-center justify-center rounded-2xl border text-base font-black tracking-tight transition-all duration-200",
                  active
                    ? "border-violet-300/70 bg-violet-500/25 text-white shadow-[0_0_0_1px_rgba(196,181,253,0.25),0_18px_40px_rgba(91,33,182,0.24)]"
                    : "border-slate-800 bg-slate-900/75 text-slate-300 hover:border-slate-600 hover:text-white",
                  disabled && "cursor-not-allowed opacity-60",
                  cell.className
                )}
              >
                {cell.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {quickPickCounts.map((count) => (
            <button
              key={count}
              type="button"
              disabled={disabled}
              onClick={() => applyQuickPick(count)}
              className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-60"
            >
              Auto {count}
            </button>
          ))}
          {typeof maxSelections === "number" ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => applyQuickPick(maxSelections)}
              className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-60"
            >
              Auto max
            </button>
          ) : null}
          <button
            type="button"
            disabled={disabled}
            onClick={() => emitMask(0n)}
            className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-60"
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Current picks</div>
            <div className="text-sm leading-6 text-slate-300">{selectionPreview}</div>
            {helperText ? <div className="text-sm text-slate-400">{helperText}</div> : null}
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Packed mask</div>
            <div className="mt-2 font-mono text-sm text-slate-100">{parsedMask === null ? "Invalid" : formatMask(safeMask)}</div>
          </div>
        </div>
        {error ? <div className="mt-3 text-sm font-medium text-rose-300">{error}</div> : null}
      </div>

      <details className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-200">
          {rawMaskLabel}
        </summary>
        <div className="mt-4 space-y-2">
          <Label htmlFor="mask-picker.raw" className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Packed uint40 value
          </Label>
          <Input
            id="mask-picker.raw"
            inputMode="text"
            value={mask}
            onChange={(event) => onMaskChange?.(event.target.value)}
            disabled={disabled}
            placeholder="0x1"
            className="font-mono text-sm"
          />
          <p className="text-xs leading-5 text-slate-500">
            Paste or audit the raw mask directly. The visible board stays the primary input surface.
          </p>
        </div>
      </details>
    </div>
  );
}
