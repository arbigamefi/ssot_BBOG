import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import type { DiceDirection } from "../../room/params";
import { DiceBar } from "./dice-bar";
import { DiceDie, type DiceDieMode } from "./dice-die";

const REVEAL_MS = 1_600;

/** Hairline section divider that fades out at both ends. */
function Divider() {
  return (
    <div
      aria-hidden
      className="mx-5 h-px"
      style={{ background: "linear-gradient(90deg, transparent, hsl(var(--border)), transparent)" }}
    />
  );
}

function clampRoll(value: number | null): number {
  if (value == null || !Number.isFinite(value)) return 50;
  return Math.max(1, Math.min(100, Math.round(value)));
}

export function DiceStage({
  isPending,
  controlsLocked = false,
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
  controlsLocked?: boolean;
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
  const locked = controlsLocked || isPending || revealing;
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
    <div className="relative z-10 w-full min-w-0 overflow-visible lg:absolute lg:inset-0 lg:overflow-y-auto lg:custom-scrollbar">
      {/* Stage atmosphere. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(130% 80% at 50% -8%, hsl(var(--surface-2)), hsl(var(--surface-0)) 60%)"
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-12 h-[420px] w-[620px] max-w-full -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, hsl(var(--brand) / 0.13), transparent 68%)" }}
      />

      <div className="relative flex min-h-full items-center justify-center px-4 py-4">
        <div
          className="relative w-full max-w-[480px] overflow-hidden rounded-xl border border-border-soft shadow-e3"
          style={{
            background: "linear-gradient(180deg, hsl(var(--surface-2)), hsl(var(--surface-1)))"
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background: "linear-gradient(90deg, transparent, hsl(var(--fg) / 0.16), transparent)"
            }}
          />

          {/* Die zone — the hero die, lit while rolling. */}
          <div className="relative flex justify-center px-5 pb-7 pt-5">
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-[220px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-500"
              style={{
                opacity: locked ? 1 : 0,
                background: "radial-gradient(circle, hsl(var(--brand) / 0.3), transparent 70%)"
              }}
            />
            <div className="relative">
              {/* Felt landing pad */}
              <div className="pointer-events-none absolute bottom-2 left-1/2 h-[54px] w-[180px] -translate-x-1/2">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "hsl(var(--surface-0))",
                    boxShadow:
                      "inset 0 2px 10px hsl(var(--surface-0) / 0.6), 0 6px 22px hsl(var(--surface-0) / 0.5)"
                  }}
                />
                <div
                  className="absolute inset-1 rounded-full"
                  style={{
                    background:
                      "radial-gradient(ellipse at 50% 22%, hsl(var(--surface-2)), hsl(var(--surface-0)))"
                  }}
                />
              </div>
              <DiceDie mode={mode} faceValue={faceValue} faceLabel={faceLabel} won={won} />
            </div>
          </div>

          <Divider />

          {/* Threshold zone — pick the win line. */}
          <div className="px-5 py-4">
            <DiceBar
              direction={diceDirection}
              target={diceTarget}
              isLocked={locked}
              onTargetChange={onTargetChange}
              targetAriaLabel={t("casino.room.selection.dice.targetAria")}
            />
          </div>

          <Divider />

          {/* Controls zone — direction toggle and odds. */}
          <div className="flex flex-col gap-3 px-5 py-4">
            <div
              role="group"
              aria-label={t("casino.room.selection.dice.targetRange")}
              className="relative flex h-11 rounded-lg bg-surface-0 p-1 shadow-inner-e1"
            >
              <span
                aria-hidden
                className={cn(
                  "absolute inset-y-1 w-[calc(50%-4px)] rounded-md bg-brand shadow-glow transition-[left] duration-200 ease-out",
                  diceDirection === "under" ? "left-1" : "left-[calc(50%+3px)]"
                )}
              />
              <button
                type="button"
                disabled={locked}
                onClick={() => onDirectionChange("under")}
                className={cn(
                  "relative z-10 flex-1 rounded-md text-xs font-semibold uppercase tracking-[0.12em] transition-colors disabled:cursor-default",
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
                  "relative z-10 flex-1 rounded-md text-xs font-semibold uppercase tracking-[0.12em] transition-colors disabled:cursor-default",
                  diceDirection === "over" ? "text-fg-inverse" : "text-fg-subtle hover:text-fg"
                )}
              >
                {t("casino.room.selection.dice.rollOver")}
              </button>
            </div>

            <dl className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-0.5 rounded-lg bg-surface-2 px-3 py-2 ring-1 ring-inset ring-border-soft">
                <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
                  {t("casino.room.selection.dice.multiplier")}
                </dt>
                <dd className="font-mono text-lg font-bold tabular-nums text-fg">
                  {multiplier.toFixed(2)}x
                </dd>
              </div>
              <div className="flex flex-col gap-0.5 rounded-lg bg-surface-2 px-3 py-2 ring-1 ring-inset ring-border-soft">
                <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
                  {t("casino.room.selection.dice.winChance")}
                </dt>
                <dd className="font-mono text-lg font-bold tabular-nums text-fg">
                  {winChance.toFixed(2)}%
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
