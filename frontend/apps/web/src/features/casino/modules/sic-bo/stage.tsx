import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import type { CasinoOutcome } from "../../room/outcome";
import { normalizeSicBoValue, sicBoMultiplier, type SicBoKind } from "../../room/params";

type SicBoRoll = Extract<CasinoOutcome, { kind: "sic-bo" }>["rolls"][number];

const FACE_VALUES = [1, 2, 3, 4, 5, 6] as const;
const TOTAL_VALUES = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17] as const;

function formatSicBoBet(kind: SicBoKind, value: number, t: ReturnType<typeof useTranslations>) {
  const label = t(`casino.room.selection.sicBo.kinds.${kind}`);
  if (kind === "total") return `${label} ${value}`;
  if (kind === "specificTriple" || kind === "specificDouble" || kind === "singleFace") {
    return `${label} ${value}`;
  }
  return label;
}

function isSicBoActive(
  currentKind: SicBoKind,
  currentValue: number,
  nextKind: SicBoKind,
  nextValue: number
) {
  if (currentKind !== nextKind) return false;
  return normalizeSicBoValue(nextKind, currentValue) === normalizeSicBoValue(nextKind, nextValue);
}

function TableBetButton({
  label,
  detail,
  active,
  disabled,
  onClick,
  wide = false
}: {
  label: string;
  detail: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-3 text-left transition-colors",
        wide && "md:col-span-2",
        active
          ? "border-brand bg-brand-soft text-fg"
          : "border-border bg-surface-1 text-fg-muted hover:border-brand/50 hover:bg-surface-2 hover:text-fg",
        disabled && "cursor-not-allowed opacity-70"
      )}
      aria-pressed={active}
    >
      <span className="block text-xs font-semibold uppercase tracking-[0.18em]">{label}</span>
      <span className="mt-2 block font-mono text-xs text-accent">{detail}</span>
    </button>
  );
}

function NumberBetButton({
  value,
  active,
  disabled,
  onClick,
  compact = false
}: {
  value: number;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-md border font-mono font-semibold transition-colors",
        compact ? "h-9 text-xs" : "h-10 text-sm",
        active
          ? "border-brand bg-brand text-fg-inverse"
          : "border-border bg-surface-1 text-fg-muted hover:border-brand/50 hover:text-fg",
        disabled && "cursor-not-allowed opacity-70"
      )}
      aria-pressed={active}
    >
      {value}
    </button>
  );
}

function DieFace({
  value,
  active,
  rolling
}: {
  value: number | undefined;
  active: boolean;
  rolling?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-24 w-24 items-center justify-center rounded-lg border bg-surface-2 shadow-inner-e1 transition-[border-color,background-color,transform]",
        active ? "border-accent/60 bg-accent-soft" : "border-border",
        rolling &&
          "animate-[sicbo-die-tumble_420ms_ease-in-out_infinite] border-brand/50 bg-brand-soft"
      )}
    >
      <span className={cn("font-mono text-4xl font-semibold", active ? "text-accent" : "text-fg")}>
        {value ?? "—"}
      </span>
    </div>
  );
}

export function SicBoStage({
  isPending,
  isRevealing,
  showResult,
  betKind,
  betValue,
  onBetChange,
  outcome,
  onRevealComplete
}: {
  isPending: boolean;
  isRevealing?: boolean;
  showResult: boolean;
  betKind: SicBoKind;
  betValue: number;
  onBetChange: (kind: SicBoKind, value: number) => void;
  outcome?: Extract<CasinoOutcome, { kind: "sic-bo" }> | null;
  onRevealComplete?: () => void;
}) {
  const t = useTranslations();
  const prefersReducedMotion = useReducedMotion();
  const roll: SicBoRoll | undefined = outcome?.rolls.at(-1);
  const [revealFrame, setRevealFrame] = React.useState(0);
  const [diceOpened, setDiceOpened] = React.useState(() => Boolean(showResult && roll));
  const hasResult = Boolean(showResult && roll && (diceOpened || !isRevealing));
  const isRollingReveal = Boolean(isRevealing && roll && !diceOpened);
  const displayDice = FACE_VALUES.slice(0, 3).map((_, index) =>
    hasResult
      ? roll?.dice[index]
      : isRollingReveal
        ? FACE_VALUES[(revealFrame + index * 2) % FACE_VALUES.length]
        : undefined
  );

  React.useEffect(() => {
    if (!isRevealing || !roll) {
      setDiceOpened(Boolean(showResult && roll));
      return;
    }

    setDiceOpened(false);
    const timeouts: number[] = [];
    const schedule = (callback: () => void, delay: number) => {
      const timeout = window.setTimeout(callback, delay);
      timeouts.push(timeout);
    };

    if (prefersReducedMotion) {
      setDiceOpened(true);
      schedule(() => onRevealComplete?.(), 180);
      return () => {
        timeouts.forEach((timeout) => window.clearTimeout(timeout));
      };
    }

    const interval = window.setInterval(() => {
      setRevealFrame((frame) => frame + 1);
    }, 110);
    schedule(() => setDiceOpened(true), 1_050);
    schedule(() => onRevealComplete?.(), 1_520);

    return () => {
      window.clearInterval(interval);
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [isRevealing, onRevealComplete, prefersReducedMotion, roll, showResult]);

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-start overflow-hidden px-6 pb-6 pt-20">
      <div className="relative flex w-full max-w-5xl flex-col items-center gap-4">
        <div className="relative grid grid-cols-3 gap-3 rounded-xl border border-border bg-surface-1 p-3 shadow-e2">
          {isRollingReveal && (
            <div
              aria-hidden
              className="absolute inset-x-5 top-3 z-10 h-16 rounded-b-3xl border border-brand/30 bg-surface-2/95 shadow-e2 animate-[sicbo-cup-shake_520ms_ease-in-out_infinite]"
            />
          )}
          {[0, 1, 2].map((index) => (
            <DieFace
              key={index}
              value={displayDice[index]}
              active={Boolean(hasResult && roll?.won)}
              rolling={isRollingReveal}
            />
          ))}
        </div>

        <div className="grid w-full grid-cols-1 gap-3 lg:grid-cols-[1fr_1.35fr]">
          <div className="grid grid-cols-2 gap-2">
            <TableBetButton
              label={t("casino.room.selection.sicBo.kinds.small")}
              detail={`${sicBoMultiplier("small", 0).toFixed(2)}x`}
              active={betKind === "small"}
              disabled={isPending}
              onClick={() => onBetChange("small", 0)}
            />
            <TableBetButton
              label={t("casino.room.selection.sicBo.kinds.big")}
              detail={`${sicBoMultiplier("big", 0).toFixed(2)}x`}
              active={betKind === "big"}
              disabled={isPending}
              onClick={() => onBetChange("big", 0)}
            />
            <TableBetButton
              label={t("casino.room.selection.sicBo.kinds.anyTriple")}
              detail={`${sicBoMultiplier("anyTriple", 0).toFixed(2)}x`}
              active={betKind === "anyTriple"}
              disabled={isPending}
              onClick={() => onBetChange("anyTriple", 0)}
              wide
            />

            <div className="rounded-lg border border-border bg-surface-1 p-3 md:col-span-2">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">
                {t("casino.room.selection.sicBo.face")}
              </p>
              <div className="grid grid-cols-6 gap-1.5">
                {FACE_VALUES.map((value) => (
                  <NumberBetButton
                    key={value}
                    value={value}
                    active={isSicBoActive(betKind, betValue, "singleFace", value)}
                    disabled={isPending}
                    onClick={() => onBetChange("singleFace", value)}
                    compact
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-lg border border-border bg-surface-1 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">
                  {t("casino.room.selection.sicBo.kinds.total")}
                </p>
                <span className="font-mono text-[10px] text-accent">
                  {t("casino.room.selection.sicBo.total")}
                </span>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {TOTAL_VALUES.map((value) => (
                  <NumberBetButton
                    key={value}
                    value={value}
                    active={isSicBoActive(betKind, betValue, "total", value)}
                    disabled={isPending}
                    onClick={() => onBetChange("total", value)}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface-1 p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">
                  {t("casino.room.selection.sicBo.kinds.specificDouble")}
                </p>
                <div className="grid grid-cols-6 gap-1.5">
                  {FACE_VALUES.map((value) => (
                    <NumberBetButton
                      key={value}
                      value={value}
                      active={isSicBoActive(betKind, betValue, "specificDouble", value)}
                      disabled={isPending}
                      onClick={() => onBetChange("specificDouble", value)}
                      compact
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-surface-1 p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">
                  {t("casino.room.selection.sicBo.kinds.specificTriple")}
                </p>
                <div className="grid grid-cols-6 gap-1.5">
                  {FACE_VALUES.map((value) => (
                    <NumberBetButton
                      key={value}
                      value={value}
                      active={isSicBoActive(betKind, betValue, "specificTriple", value)}
                      disabled={isPending}
                      onClick={() => onBetChange("specificTriple", value)}
                      compact
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid w-full max-w-xl grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-surface-1 px-4 py-3 text-center shadow-inner-e1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
              {t("casino.room.stage.sicBo.total")}
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold text-fg">{roll?.total ?? "—"}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface-1 px-4 py-3 text-center shadow-inner-e1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
              {t("casino.room.stage.sicBo.triple")}
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold text-fg">
              {roll == null
                ? "—"
                : roll.triple
                  ? t("casino.room.selection.slots.yes")
                  : t("casino.room.selection.slots.no")}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface-1 px-4 py-3 text-center shadow-inner-e1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
              {t("casino.room.stage.sicBo.result")}
            </p>
            <p
              className={cn(
                "mt-1 font-mono text-2xl font-semibold",
                roll?.won ? "text-success" : hasResult ? "text-danger" : "text-fg"
              )}
            >
              {roll == null
                ? "—"
                : roll.won
                  ? t("casino.room.result.outcomes.win.label")
                  : t("casino.room.result.outcomes.loss.label")}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface-1/90 px-5 py-3 text-center shadow-e1 backdrop-blur">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-fg-subtle">
            {isPending || isRevealing
              ? t("casino.room.stage.sicBo.rolling")
              : hasResult
                ? t("casino.room.stage.sicBo.opened", { dice: roll?.dice.join(" / ") ?? "—" })
                : t("casino.room.stage.sicBo.ready")}
          </p>
          <p className="mt-1 font-mono text-sm font-semibold uppercase tracking-widest text-fg">
            {formatSicBoBet(betKind, betValue, t)}
          </p>
        </div>
      </div>
    </div>
  );
}
