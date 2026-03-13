import * as React from "react";

import { cn } from "../../lib/utils";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const STRAIGHT_NUMBERS = Array.from({ length: 36 }, (_value, index) => index + 1);
const TABLE_ROWS = [
  { column: 3 as const, numbers: Array.from({ length: 12 }, (_value, index) => index * 3 + 3) },
  { column: 2 as const, numbers: Array.from({ length: 12 }, (_value, index) => index * 3 + 2) },
  { column: 1 as const, numbers: Array.from({ length: 12 }, (_value, index) => index * 3 + 1) },
];
const STREET_STARTS = Array.from({ length: 12 }, (_value, index) => index * 3 + 1);
const SIX_LINE_STARTS = Array.from({ length: 11 }, (_value, index) => index * 3 + 1);
const CORNER_STARTS = Array.from({ length: 32 }, (_value, index) => index + 1).filter((value) => value % 3 !== 0);

const OUTSIDE_BETS = [
  { kind: "low", label: "1 to 18", helper: "Low half" },
  { kind: "even", label: "Even", helper: "All even numbers" },
  { kind: "red", label: "Red", helper: "18 red numbers" },
  { kind: "black", label: "Black", helper: "18 black numbers" },
  { kind: "odd", label: "Odd", helper: "All odd numbers" },
  { kind: "high", label: "19 to 36", helper: "High half" },
] as const;

const DOZENS = [
  { dozen: 1 as const, label: "1 to 12", helper: "First dozen" },
  { dozen: 2 as const, label: "13 to 24", helper: "Second dozen" },
  { dozen: 3 as const, label: "25 to 36", helper: "Third dozen" },
];

type SplitOption = {
  value: string;
  label: string;
  first: number;
  second: number;
};

function buildSplitOptions(): SplitOption[] {
  const options: SplitOption[] = [];

  for (const number of STRAIGHT_NUMBERS) {
    if (number % 3 !== 0) {
      options.push({
        value: `${number}-${number + 1}`,
        label: `${number} / ${number + 1}`,
        first: number,
        second: number + 1,
      });
    }
    if (number <= 33) {
      options.push({
        value: `${number}-${number + 3}`,
        label: `${number} / ${number + 3}`,
        first: number,
        second: number + 3,
      });
    }
  }

  return options;
}

const SPLIT_OPTIONS = buildSplitOptions();

export type RouletteSelection =
  | { kind: "straight"; number: number }
  | { kind: "split"; first: number; second: number }
  | { kind: "street"; start: number }
  | { kind: "corner"; start: number }
  | { kind: "sixLine"; start: number }
  | { kind: "dozen"; dozen: 1 | 2 | 3 }
  | { kind: "column"; column: 1 | 2 | 3 }
  | { kind: "red" | "black" | "odd" | "even" | "low" | "high" }
  | { kind: "bitmask"; mask: string };

export type RouletteParamsFormProps = {
  title?: string;
  description?: string;
  selection: RouletteSelection;
  onChange?: (selection: RouletteSelection) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
};

export function createDefaultRouletteSelection(): RouletteSelection {
  return { kind: "straight", number: 0 };
}

function parseMask(mask: string): bigint | null {
  const raw = mask.trim();
  if (!raw) return 0n;
  try {
    const parsed = BigInt(raw);
    if (parsed < 0n) return null;
    return parsed;
  } catch {
    return null;
  }
}

function countBits(mask: bigint, limit = 37) {
  let total = 0;
  for (let index = 0; index < limit; index += 1) {
    if ((mask & (1n << BigInt(index))) !== 0n) total += 1;
  }
  return total;
}

function coverageLabel(count: number) {
  return `${count} number${count === 1 ? "" : "s"}`;
}

export function summarizeRouletteSelection(selection: RouletteSelection) {
  switch (selection.kind) {
    case "straight":
      return {
        family: "Straight",
        display: `Straight ${selection.number}`,
        coverage: 1,
        helper: "Single-number call. Highest variance, tightest coverage.",
      };
    case "split":
      return {
        family: "Split",
        display: `Split ${selection.first}/${selection.second}`,
        coverage: 2,
        helper: "Two-number line bet across one edge on the table.",
      };
    case "street":
      return {
        family: "Street",
        display: `Street ${selection.start}-${selection.start + 2}`,
        coverage: 3,
        helper: "Three-number row bet on a single street.",
      };
    case "corner":
      return {
        family: "Corner",
        display: `Corner ${selection.start}-${selection.start + 1}-${selection.start + 3}-${selection.start + 4}`,
        coverage: 4,
        helper: "Four-number square covering a 2x2 block.",
      };
    case "sixLine":
      return {
        family: "Six line",
        display: `Six line ${selection.start}-${selection.start + 5}`,
        coverage: 6,
        helper: "Two adjacent streets bundled into one six-number line.",
      };
    case "dozen":
      return {
        family: "Dozen",
        display: `${selection.dozen}${selection.dozen === 1 ? "st" : selection.dozen === 2 ? "nd" : "rd"} 12`,
        coverage: 12,
        helper: "Twelve-number outside bet on one dozen block.",
      };
    case "column":
      return {
        family: "Column",
        display: `Column ${selection.column}`,
        coverage: 12,
        helper: "One of the three vertical columns on the table.",
      };
    case "red":
    case "black":
    case "odd":
    case "even":
    case "low":
    case "high":
      return {
        family: "Outside",
        display:
          selection.kind === "low"
            ? "1-18"
            : selection.kind === "high"
              ? "19-36"
              : selection.kind.charAt(0).toUpperCase() + selection.kind.slice(1),
        coverage: 18,
        helper: "Classic outside bet with the widest standard coverage.",
      };
    case "bitmask": {
      const parsed = parseMask(selection.mask);
      if (parsed === null) {
        return {
          family: "Raw mask",
          display: "Invalid mask",
          coverage: 0,
          helper: "The raw selection is malformed. Fix the mask before planning.",
        };
      }
      return {
        family: "Raw mask",
        display: parsed === 0n ? "Mask 0x0" : `Mask ${selection.mask}`,
        coverage: countBits(parsed),
        helper: "Advanced mode bypassing the typed table helpers.",
      };
    }
  }
}

function numberTone(number: number) {
  if (number === 0) return "border-emerald-400/50 bg-emerald-500/20 text-emerald-50";
  return RED_NUMBERS.has(number)
    ? "border-rose-400/40 bg-rose-500/20 text-rose-50"
    : "border-slate-600 bg-slate-900/90 text-slate-100";
}

function parseSplitValue(value: string) {
  const [firstRaw, secondRaw] = value.split("-");
  return {
    first: Number(firstRaw),
    second: Number(secondRaw),
  };
}

export function RouletteParamsForm(props: RouletteParamsFormProps) {
  const {
    title = "European roulette",
    description = "Standard 0-36 wheel. Start with the table, then size the ticket on the left.",
    selection,
    onChange,
    disabled = false,
    error,
    className,
  } = props;

  const summary = summarizeRouletteSelection(selection);
  const coverage = coverageLabel(summary.coverage);
  const splitValue =
    selection.kind === "split" ? `${selection.first}-${selection.second}` : `${SPLIT_OPTIONS[0]?.first ?? 1}-${SPLIT_OPTIONS[0]?.second ?? 2}`;
  const streetValue = selection.kind === "street" ? String(selection.start) : "1";
  const cornerValue = selection.kind === "corner" ? String(selection.start) : "1";
  const sixLineValue = selection.kind === "sixLine" ? String(selection.start) : "1";
  const selectionModeNote =
    selection.kind === "bitmask"
      ? "Advanced raw route. Use only when you intentionally need manual mask parity."
      : "One table call per ticket. Pick the table bet first, then size the slip.";

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-[2rem] border border-fuchsia-400/15 bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.16),transparent_22%),radial-gradient(circle_at_center,rgba(59,130,246,0.08),transparent_38%),linear-gradient(180deg,rgba(30,16,46,0.96),rgba(8,12,24,0.98))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-white/10 bg-slate-950/45 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <div className="text-xl font-black tracking-tight text-white">{summary.display}</div>
              <div className="inline-flex rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200">
                {coverage}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden rounded-full border border-white/10 bg-slate-950/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300 sm:inline-flex">
              Standard 0-36 wheel
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange?.(createDefaultRouletteSelection())}
              className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-200 transition-colors hover:border-white/20 hover:text-white disabled:opacity-60"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-[1.3rem] border border-fuchsia-400/10 bg-fuchsia-500/5 px-4 py-3 text-sm leading-6 text-slate-300">
          {summary.helper}
        </div>

        {description ? <p className="mt-4 text-sm leading-6 text-slate-400">{description}</p> : null}

        <div className="mt-5 rounded-[1.85rem] border border-fuchsia-300/10 bg-[radial-gradient(circle_at_top,rgba(190,24,93,0.18),transparent_24%),linear-gradient(180deg,rgba(31,12,48,0.88),rgba(17,24,39,0.92))] p-4 shadow-[0_24px_70px_rgba(76,29,149,0.14)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Main table</div>
              <div className="mt-1 text-base font-semibold text-white">Pick the wheel result or one standard coverage</div>
            </div>
            <div className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
              European table
            </div>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="min-w-[58rem]">
              <div className="grid grid-cols-[72px_repeat(12,minmax(0,1fr))_72px] gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange?.({ kind: "straight", number: 0 })}
                  className={cn(
                    "row-span-3 flex min-h-[10.4rem] items-center justify-center rounded-[1.4rem] border text-4xl font-black transition-all duration-200",
                    selection.kind === "straight" && selection.number === 0
                      ? "border-emerald-300/80 bg-emerald-400/20 text-white shadow-[0_18px_40px_rgba(16,185,129,0.18)]"
                      : `${numberTone(0)} hover:border-emerald-300/70 hover:text-white`,
                    disabled && "cursor-not-allowed opacity-60"
                  )}
                >
                  0
                </button>

                {TABLE_ROWS.map((row) => (
                  <React.Fragment key={row.column}>
                    {row.numbers.map((number) => {
                      const active = selection.kind === "straight" && selection.number === number;
                      return (
                        <button
                          key={number}
                          type="button"
                          disabled={disabled}
                          onClick={() => onChange?.({ kind: "straight", number })}
                          className={cn(
                            "rounded-[0.95rem] border px-3 py-3 text-lg font-black transition-all duration-200",
                            active
                              ? "border-amber-300/80 bg-amber-400/20 text-white shadow-[0_16px_36px_rgba(245,158,11,0.18)]"
                              : `${numberTone(number)} hover:border-slate-300/60 hover:text-white`,
                            disabled && "cursor-not-allowed opacity-60"
                          )}
                        >
                          {number}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange?.({ kind: "column", column: row.column })}
                      className={cn(
                        "rounded-[0.95rem] border px-3 py-3 text-sm font-black transition-all duration-200",
                        selection.kind === "column" && selection.column === row.column
                          ? "border-sky-300/70 bg-sky-500/20 text-white shadow-[0_18px_40px_rgba(14,165,233,0.18)]"
                          : "border-white/10 bg-white/[0.06] text-slate-200 hover:border-white/20 hover:text-white",
                        disabled && "cursor-not-allowed opacity-60"
                      )}
                    >
                      2:1
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {DOZENS.map((item) => {
              const active = selection.kind === "dozen" && selection.dozen === item.dozen;
              return (
                <button
                  key={item.dozen}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange?.({ kind: "dozen", dozen: item.dozen })}
                  className={cn(
                    "rounded-[1.15rem] border px-4 py-3 text-left transition-all duration-200",
                    active
                      ? "border-violet-300/70 bg-violet-500/20 text-white shadow-[0_18px_40px_rgba(91,33,182,0.2)]"
                      : "border-slate-700 bg-slate-950/55 text-slate-300 hover:border-slate-500 hover:text-white",
                    disabled && "cursor-not-allowed opacity-60"
                  )}
                >
                  <div className="text-sm font-black">{item.label}</div>
                  <div className="mt-1 text-xs text-slate-400">{item.helper}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {OUTSIDE_BETS.map((item) => {
              const active = selection.kind === item.kind;
              return (
                <button
                  key={item.kind}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange?.({ kind: item.kind })}
                  className={cn(
                    "rounded-[1.1rem] border px-4 py-3 text-left transition-all duration-200",
                    active
                      ? "border-emerald-300/70 bg-emerald-500/18 text-white shadow-[0_16px_36px_rgba(16,185,129,0.16)]"
                      : "border-slate-700 bg-slate-950/55 text-slate-300 hover:border-slate-500 hover:text-white",
                    disabled && "cursor-not-allowed opacity-60"
                  )}
                >
                  <div className="text-sm font-black">{item.label}</div>
                  <div className="mt-1 text-xs text-slate-400">{item.helper}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="rounded-[1.5rem] border border-fuchsia-300/10 bg-slate-950/35 p-4">
            <div className="mb-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Layout bets</div>
              <div className="mt-1 text-sm font-semibold text-white">Structured table shapes</div>
            </div>

            <div className="space-y-3">
              <div className={cn("rounded-[1.1rem] border p-3", selection.kind === "split" ? "border-violet-300/60 bg-violet-500/10" : "border-slate-700 bg-slate-950/55")}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white">Split</div>
                  <div className="text-xs text-slate-500">2 numbers</div>
                </div>
                <select
                  value={splitValue}
                  disabled={disabled}
                  onChange={(event) => {
                    const next = parseSplitValue(event.target.value);
                    onChange?.({ kind: "split", first: next.first, second: next.second });
                  }}
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950/85 px-3 text-sm font-medium text-white outline-none"
                >
                  {SPLIT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={cn("rounded-[1.1rem] border p-3", selection.kind === "street" ? "border-violet-300/60 bg-violet-500/10" : "border-slate-700 bg-slate-950/55")}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white">Street</div>
                  <div className="text-xs text-slate-500">3 numbers</div>
                </div>
                <select
                  value={streetValue}
                  disabled={disabled}
                  onChange={(event) => onChange?.({ kind: "street", start: Number(event.target.value) })}
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950/85 px-3 text-sm font-medium text-white outline-none"
                >
                  {STREET_STARTS.map((start) => (
                    <option key={start} value={start}>
                      {start}-{start + 2}
                    </option>
                  ))}
                </select>
              </div>

              <div className={cn("rounded-[1.1rem] border p-3", selection.kind === "corner" ? "border-violet-300/60 bg-violet-500/10" : "border-slate-700 bg-slate-950/55")}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white">Corner</div>
                  <div className="text-xs text-slate-500">4 numbers</div>
                </div>
                <select
                  value={cornerValue}
                  disabled={disabled}
                  onChange={(event) => onChange?.({ kind: "corner", start: Number(event.target.value) })}
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950/85 px-3 text-sm font-medium text-white outline-none"
                >
                  {CORNER_STARTS.map((start) => (
                    <option key={start} value={start}>
                      {start}-{start + 1}-{start + 3}-{start + 4}
                    </option>
                  ))}
                </select>
              </div>

              <div className={cn("rounded-[1.1rem] border p-3", selection.kind === "sixLine" ? "border-violet-300/60 bg-violet-500/10" : "border-slate-700 bg-slate-950/55")}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white">Six line</div>
                  <div className="text-xs text-slate-500">6 numbers</div>
                </div>
                <select
                  value={sixLineValue}
                  disabled={disabled}
                  onChange={(event) => onChange?.({ kind: "sixLine", start: Number(event.target.value) })}
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950/85 px-3 text-sm font-medium text-white outline-none"
                >
                  {SIX_LINE_STARTS.map((start) => (
                    <option key={start} value={start}>
                      {start}-{start + 5}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/30 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Table note</div>
              <div className="mt-2 text-sm leading-6 text-slate-300">{selectionModeNote}</div>
            </div>

            <details className="rounded-[1.5rem] border border-white/10 bg-slate-950/30 p-4">
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-200">Advanced raw bitmask</summary>
              <div className="mt-4 space-y-2">
                <Label htmlFor="roulette.raw-mask" className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  uint40 legacy mask
                </Label>
                <Input
                  id="roulette.raw-mask"
                  inputMode="text"
                  value={selection.kind === "bitmask" ? selection.mask : ""}
                  onChange={(event) => onChange?.({ kind: "bitmask", mask: event.target.value })}
                  disabled={disabled}
                  placeholder="0x1"
                  className="font-mono text-sm"
                />
                <p className="text-xs leading-5 text-slate-500">
                  Raw mode is for audits or parity checks only. Use the standard table above for normal betting.
                </p>
              </div>
            </details>
          </div>
        </div>
        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      </div>
    </div>
  );
}
