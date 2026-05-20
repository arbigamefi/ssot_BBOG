import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import type { CasinoOutcome } from "../../room/outcome";
import { normalizeSicBoValue, sicBoMultiplier, type SicBoKind } from "../../room/params";
import { SicBoDie, type SicBoDieMode } from "./sic-bo-die";

/**
 * SicBoStage — a Sic Bo table, not a dashboard panel.
 *
 * Stage realism: a felt table with a recessed dice well and a frosted dice
 * dome (cup) that sits over the dice, plus the on-felt bet layout.
 *
 * Animation realism: three real 3D pip dice tumble inside the covered dome,
 * the dome lifts away, and the dice spring-settle onto their result faces
 * (see SicBoDie). The reveal timing and VRF state machine are preserved.
 */

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
  const prefersReducedMotion = useReducedMotion() ?? false;
  const roll: SicBoRoll | undefined = outcome?.rolls.at(-1);
  const [diceOpened, setDiceOpened] = React.useState(() => Boolean(showResult && roll));
  const hasResult = Boolean(showResult && roll && (diceOpened || !isRevealing));
  const isRollingReveal = Boolean(isRevealing && roll && !diceOpened);
  const covered = isPending || isRollingReveal;

  // VRF reveal state machine — unchanged timing: dome lift + completion.
  React.useEffect(() => {
    if (!isRevealing || !roll) {
      setDiceOpened(Boolean(showResult && roll));
      return;
    }

    setDiceOpened(false);
    const timeouts: number[] = [];
    const schedule = (callback: () => void, delay: number) => {
      timeouts.push(window.setTimeout(callback, delay));
    };

    if (prefersReducedMotion) {
      setDiceOpened(true);
      schedule(() => onRevealComplete?.(), 180);
      return () => timeouts.forEach((timeout) => window.clearTimeout(timeout));
    }

    schedule(() => setDiceOpened(true), 1_050);
    schedule(() => onRevealComplete?.(), 1_520);

    return () => timeouts.forEach((timeout) => window.clearTimeout(timeout));
  }, [isRevealing, onRevealComplete, prefersReducedMotion, roll, showResult]);

  const dieMode: SicBoDieMode = covered ? "rolling" : hasResult ? "settled" : "idle";

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-start overflow-hidden px-6 pb-6 pt-16">
      <div className="relative flex w-full max-w-5xl flex-col items-center gap-4">
        {/* ---- Dice well ---- */}
        <div className="relative w-full max-w-md">
          <div className="relative rounded-xl border-4 border-border-strong bg-surface-1 p-2 shadow-e3">
            <div className="relative flex items-center justify-center gap-3 overflow-hidden rounded-lg border border-border bg-surface-0 px-4 py-6 shadow-inner-e1">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 120%, hsl(var(--brand) / 0.12), transparent 60%)"
                }}
              />
              {[0, 1, 2].map((index) => (
                <SicBoDie
                  key={index}
                  value={roll?.dice[index] ?? FACE_VALUES[index] ?? 1}
                  mode={dieMode}
                  seed={index}
                  won={Boolean(hasResult && roll?.won)}
                  reduced={prefersReducedMotion}
                />
              ))}

              {/* Frosted dome / dice cup */}
              <AnimatePresence>
                {covered ? (
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 bottom-3 z-10 h-36 w-64 rounded-t-full rounded-b-lg border border-border-strong bg-surface-2/85 backdrop-blur-sm"
                    initial={{ y: 0, opacity: 1 }}
                    animate={
                      prefersReducedMotion
                        ? { y: 0, opacity: 1 }
                        : { x: [-4, 4, -4], rotate: [-1.4, 1.4, -1.4] }
                    }
                    exit={{ y: -150, opacity: 0 }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0 }
                        : {
                            x: { repeat: Infinity, duration: 0.42 },
                            rotate: { repeat: Infinity, duration: 0.42 }
                          }
                    }
                    style={{ transformOrigin: "50% 100%", marginLeft: -128 }}
                  >
                    <span className="absolute inset-x-6 top-5 h-px bg-fg/10" />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ---- Bet layout ---- */}
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

        {/* ---- Result row ---- */}
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

        {/* ---- Status readout ---- */}
        <div className="rounded-lg border border-border bg-surface-1 px-5 py-2.5 text-center shadow-e1">
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
