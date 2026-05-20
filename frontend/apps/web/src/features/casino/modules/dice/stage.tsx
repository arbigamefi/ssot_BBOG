import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import type { DiceDirection } from "../../room/params";
import { DiceBar } from "./dice-bar";
import { DiceDie, type DiceDieMode } from "./dice-die";

const REVEAL_MS = 1_600;

function clampRoll(value: number | null): number {
  if (value == null || !Number.isFinite(value)) return 50;
  return Math.max(1, Math.min(100, Math.round(value)));
}

export function DiceStage({
  isPending,
  isRevealing,
  showResult,
  resultNum,
  diceDirection,
  diceTarget,
  multiplier,
  winChance,
  onDirectionChange,
  onTargetChange,
  onRevealComplete
}: {
  isPending: boolean;
  isRevealing?: boolean;
  showResult: boolean;
  resultNum: number | null;
  diceDirection: DiceDirection;
  diceTarget: number;
  multiplier: number;
  winChance: number;
  onDirectionChange: (direction: DiceDirection) => void;
  onTargetChange: (target: number) => void;
  onRevealComplete?: () => void;
}) {
  const t = useTranslations();
  const revealing = Boolean(isRevealing);
  const locked = isPending || revealing;
  const hasResult = resultNum != null;
  const settled = showResult && !revealing && hasResult;

  // Die mode: rolling while VRF pending (result unknown), revealing while the
  // landing animation plays, settled once the roll is shown, idle otherwise.
  const mode: DiceDieMode = revealing
    ? "revealing"
    : isPending
      ? "rolling"
      : settled
        ? "settled"
        : "idle";

  // Front face: roll number once known, target while still picking.
  const faceValue = revealing || settled ? clampRoll(resultNum) : diceTarget;
  const faceLabel =
    revealing || settled
      ? t("casino.room.selection.dice.roll")
      : t("casino.room.selection.dice.target");

  const won =
    settled && hasResult
      ? diceDirection === "under"
        ? clampRoll(resultNum) <= diceTarget
        : clampRoll(resultNum) > diceTarget
      : null;

  React.useEffect(() => {
    if (!revealing || resultNum == null) return;
    const timeout = window.setTimeout(() => onRevealComplete?.(), REVEAL_MS);
    return () => window.clearTimeout(timeout);
  }, [revealing, onRevealComplete, resultNum]);

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-7 px-6 py-10">
      {/* ---- Felt dice tray ---- */}
      <div className="relative w-full max-w-md">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-4 left-1/2 h-8 w-3/4 -translate-x-1/2 rounded-[50%] bg-black/50 blur-2xl"
        />
        <div className="relative rounded-2xl border-4 border-border-strong bg-surface-1 p-2 shadow-e3">
          <div className="relative flex items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-0 py-3 shadow-inner-e1">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_28%,hsl(var(--brand)/0.1),transparent_62%)]"
            />
            {/* felt landing-zone stencil */}
            <div
              aria-hidden
              className="pointer-events-none absolute h-44 w-44 rounded-full border border-dashed border-border-soft/70"
            />
            <DiceDie mode={mode} faceValue={faceValue} faceLabel={faceLabel} won={won} />
          </div>
        </div>
      </div>

      <div className="w-full max-w-2xl">
        <DiceBar
          direction={diceDirection}
          target={diceTarget}
          isLocked={locked}
          onTargetChange={onTargetChange}
          targetAriaLabel={t("casino.room.selection.dice.targetAria")}
        />
      </div>

      <div className="flex w-full max-w-2xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Direction toggle */}
        <div
          role="group"
          aria-label={t("casino.room.selection.dice.targetRange")}
          className="relative flex h-11 w-full rounded-md border border-border bg-surface-2 p-1 sm:w-56"
        >
          <span
            aria-hidden
            className={cn(
              "absolute inset-y-1 w-[calc(50%-4px)] rounded-[5px] bg-brand transition-[left] duration-200 ease-out",
              diceDirection === "under" ? "left-1" : "left-[calc(50%+3px)]"
            )}
          />
          <button
            type="button"
            disabled={locked}
            onClick={() => onDirectionChange("under")}
            className={cn(
              "relative z-10 flex-1 rounded-[5px] text-xs font-semibold uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed",
              diceDirection === "under" ? "text-fg-inverse" : "text-fg-subtle hover:text-fg"
            )}
          >
            {t("casino.room.selection.dice.rollUnder")}
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={() => onDirectionChange("over")}
            className={cn(
              "relative z-10 flex-1 rounded-[5px] text-xs font-semibold uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed",
              diceDirection === "over" ? "text-fg-inverse" : "text-fg-subtle hover:text-fg"
            )}
          >
            {t("casino.room.selection.dice.rollOver")}
          </button>
        </div>

        {/* Multiplier + win chance */}
        <dl className="flex items-center gap-6">
          <div className="flex flex-col">
            <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
              {t("casino.room.selection.dice.multiplier")}
            </dt>
            <dd className="font-mono text-lg font-semibold tabular-nums text-fg">
              {multiplier.toFixed(2)}x
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
              {t("casino.room.selection.dice.winChance")}
            </dt>
            <dd className="font-mono text-lg font-semibold tabular-nums text-fg">
              {winChance.toFixed(2)}%
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
