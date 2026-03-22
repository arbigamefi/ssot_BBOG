"use client";

import * as React from "react";

import { cn } from "../../lib/utils";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { RouletteBoard } from "./roulette-board";

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
  const selectionKind = selection.kind;
  const multiplier = summary.coverage > 0 ? 36 / summary.coverage : 0;
  const selectionModeNote =
    selection.kind === "bitmask"
      ? "Advanced raw route. Use only when you intentionally need manual mask parity."
      : "One table call per ticket. Pick the table bet first, then size the slip.";

  return (
    <div className={cn("flex flex-col items-center space-y-5", className)}>
      <div className="relative flex min-h-[420px] w-full items-center justify-center overflow-hidden rounded-[2rem] border border-white/6 bg-[linear-gradient(180deg,rgba(16,21,39,0.98),rgba(11,16,28,0.98))] px-4 py-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[53%] h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[48px] border-slate-950/70 opacity-52" />
          <div className="absolute left-1/2 top-[53%] h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[conic-gradient(from_0deg,rgba(127,29,29,0.38)_0deg,rgba(15,23,42,0.7)_16deg,rgba(15,23,42,0.7)_32deg,rgba(127,29,29,0.38)_48deg,rgba(15,23,42,0.7)_64deg,rgba(15,23,42,0.7)_80deg,rgba(127,29,29,0.38)_96deg,rgba(15,23,42,0.7)_112deg,rgba(15,23,42,0.7)_128deg,rgba(127,29,29,0.38)_144deg,rgba(15,23,42,0.7)_160deg,rgba(15,23,42,0.7)_176deg,rgba(127,29,29,0.38)_192deg,rgba(15,23,42,0.7)_208deg,rgba(15,23,42,0.7)_224deg,rgba(127,29,29,0.38)_240deg,rgba(15,23,42,0.7)_256deg,rgba(15,23,42,0.7)_272deg,rgba(127,29,29,0.38)_288deg,rgba(15,23,42,0.7)_304deg,rgba(15,23,42,0.7)_320deg,rgba(127,29,29,0.38)_336deg,rgba(15,23,42,0.7)_352deg,rgba(15,23,42,0.7)_360deg)] [mask-image:radial-gradient(circle,transparent_0_56%,black_57%_74%,transparent_75%)] opacity-18" />
          <div className="absolute left-1/2 top-[15%] h-20 w-3 -translate-x-[5.8rem] -translate-y-1/2 rotate-45 rounded-full bg-[#7a5d2d]/32" />
          <div className="absolute left-1/2 top-[15%] h-20 w-3 -translate-x-[5.8rem] -translate-y-1/2 -rotate-45 rounded-full bg-[#7a5d2d]/32" />
          <div className="absolute left-1/2 top-[15%] h-20 w-3 translate-x-[5.8rem] -translate-y-1/2 rotate-45 rounded-full bg-[#7a5d2d]/32" />
          <div className="absolute left-1/2 top-[15%] h-20 w-3 translate-x-[5.8rem] -translate-y-1/2 -rotate-45 rounded-full bg-[#7a5d2d]/32" />
          <div className="absolute left-1/2 top-[11%] -translate-x-1/2 text-[4.4rem] font-black tracking-[-0.08em] text-white/95 drop-shadow-[0_10px_40px_rgba(0,0,0,0.55)]">{
            `${multiplier.toFixed(2)}x`
          }</div>
          <div className="absolute left-1/2 top-[31%] h-20 w-20 -translate-x-1/2 rounded-full border-[8px] border-[#7a5d2d]/14 opacity-12" />
        </div>

        <div className="relative z-10 flex w-full justify-center overflow-x-auto pt-24">
          <RouletteBoard
            selection={selection}
            onBetPlaced={(s) => onChange?.(s)}
          />
        </div>
      </div>

      {selection.kind === "bitmask" ? (
      <details className="w-full rounded-[1.25rem] border border-white/8 bg-white/[0.025] p-4">
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Advanced routes</div>
              <div className="mt-1 text-sm font-semibold text-white">{summary.display} · {summary.family} · {coverage}</div>
            </div>
            <div className="text-xs leading-5 text-slate-400">
              {selectionModeNote}
            </div>
          </div>
        </summary>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.5rem] border border-fuchsia-300/10 bg-slate-950/35 p-5">
            <div className="mb-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Structured combinations</div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className={cn("rounded-xl border p-3", selectionKind === "split" ? "border-violet-300/60 bg-violet-500/10" : "border-white/5 bg-white/5")}>
                  <div className="mb-2 text-[10px] font-bold uppercase text-slate-500">Split (2 nums)</div>
                  <select
                    value={splitValue}
                    disabled={disabled}
                    onChange={(event) => {
                      const next = parseSplitValue(event.target.value);
                      onChange?.({ kind: "split", first: next.first, second: next.second });
                    }}
                    className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950/85 px-2 text-xs font-medium text-white outline-none"
                  >
                    {SPLIT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className={cn("rounded-xl border p-3", selectionKind === "street" ? "border-violet-300/60 bg-violet-500/10" : "border-white/5 bg-white/5")}>
                  <div className="mb-2 text-[10px] font-bold uppercase text-slate-500">Street (3 nums)</div>
                  <select
                    value={streetValue}
                    disabled={disabled}
                    onChange={(event) => onChange?.({ kind: "street", start: Number(event.target.value) })}
                    className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950/85 px-2 text-xs font-medium text-white outline-none"
                  >
                    {STREET_STARTS.map((start) => (
                      <option key={start} value={start}>{start}-{start + 2}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className={cn("rounded-xl border p-3", selectionKind === "corner" ? "border-violet-300/60 bg-violet-500/10" : "border-white/5 bg-white/5")}>
                  <div className="mb-2 text-[10px] font-bold uppercase text-slate-500">Corner (4 nums)</div>
                  <select
                    value={cornerValue}
                    disabled={disabled}
                    onChange={(event) => onChange?.({ kind: "corner", start: Number(event.target.value) })}
                    className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950/85 px-2 text-xs font-medium text-white outline-none"
                  >
                    {CORNER_STARTS.map((start) => <option key={start} value={start}>{start}-{start+1}-{start+3}-{start+4}</option>)}
                  </select>
                </div>
                <div className={cn("rounded-xl border p-3", selectionKind === "sixLine" ? "border-violet-300/60 bg-violet-500/10" : "border-white/5 bg-white/5")}>
                  <div className="mb-2 text-[10px] font-bold uppercase text-slate-500">Six line (6 nums)</div>
                  <select
                    value={sixLineValue}
                    disabled={disabled}
                    onChange={(event) => onChange?.({ kind: "sixLine", start: Number(event.target.value) })}
                    className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950/85 px-2 text-xs font-medium text-white outline-none"
                  >
                    {SIX_LINE_STARTS.map((start) => (
                      <option key={start} value={start}>{start}-{start + 5}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/5 bg-slate-950/35 p-5">
            <div className="mb-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Protocol verification</div>
            </div>
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="roulette.mask" className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                  Packed selection bitmask
                </Label>
                <Input
                  id="roulette.mask"
                  value={selection.kind === "bitmask" ? selection.mask : ""}
                  disabled={disabled}
                  placeholder="Auto-calculated from board..."
                  onChange={(event) => onChange?.({ kind: "bitmask", mask: event.target.value })}
                  className="h-11 border-slate-700 bg-slate-950/70 font-mono text-sm text-white"
                />
                <p className="text-[10px] font-medium uppercase leading-relaxed text-slate-500">
                  This raw mask represents the exact bits passed to the RNG auditor for your bet.
                </p>
              </div>
            </div>
          </div>
        </div>
      </details>
      ) : null}
      {error ? <p className="text-sm font-semibold text-rose-400">{error}</p> : null}
    </div>
  );
}
