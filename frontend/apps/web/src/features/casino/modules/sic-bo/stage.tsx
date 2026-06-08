import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import type { CasinoOutcome } from "../../room/outcome";
import { normalizeSicBoValue, sicBoMultiplier, type SicBoKind } from "../../room/params";
import { SicBoDie, type SicBoDieMode } from "./sic-bo-die";

/**
 * SicBoStage — a Sic Bo table inside the shared game console.
 *
 * The felt keeps a recessed dice well with a frosted dice dome over three real
 * 3D pip dice, plus the on-felt bet layout. The dome lift and VRF reveal state
 * machine are unchanged — only the cabinet chrome was rebuilt into the console
 * language.
 */

type SicBoRoll = Extract<CasinoOutcome, { kind: "sic-bo" }>["rolls"][number];

const FACE_VALUES = [1, 2, 3, 4, 5, 6] as const;
const TOTAL_VALUES = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17] as const;

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

/** Labelled group wrapper for a cluster of bets. */
function BetGroup({
  label,
  trailing,
  className,
  children
}: {
  label: string;
  trailing?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg bg-surface-0/50 p-2.5 ring-1 ring-inset ring-border-soft",
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">
          {label}
        </p>
        {trailing}
      </div>
      {children}
    </div>
  );
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
      aria-pressed={active}
      className={cn(
        "rounded-lg px-3 py-2.5 text-left transition-[transform,box-shadow,background-color]",
        wide && "col-span-2",
        active
          ? "-translate-y-0.5 bg-brand-soft shadow-glow ring-1 ring-inset ring-brand"
          : "bg-surface-3 shadow-e1 ring-1 ring-inset ring-border-soft",
        !active && !disabled && "hover:-translate-y-0.5 hover:ring-brand/40",
        disabled && "cursor-default opacity-60"
      )}
    >
      <span
        className={cn(
          "block text-xs font-semibold uppercase tracking-[0.18em]",
          active ? "text-fg" : "text-fg-muted"
        )}
      >
        {label}
      </span>
      <span className="mt-1.5 block font-mono text-xs text-accent">{detail}</span>
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
      aria-pressed={active}
      className={cn(
        "rounded-md font-mono font-bold transition-[transform,box-shadow,background-color,color]",
        compact ? "h-10 text-xs sm:h-9" : "h-11 text-sm sm:h-10",
        active
          ? "bg-brand text-fg-inverse shadow-glow"
          : "bg-surface-2 text-fg-muted ring-1 ring-inset ring-border-soft",
        !active && !disabled && "hover:text-fg hover:ring-brand/40",
        disabled && "cursor-default opacity-60"
      )}
    >
      {value}
    </button>
  );
}

export function SicBoStage({
  isPending,
  controlsLocked = false,
  isRevealing,
  showResult,
  betKind,
  betValue,
  onBetChange,
  outcome,
  onRevealComplete
}: {
  isPending: boolean;
  controlsLocked?: boolean;
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
  const selectionDisabled = controlsLocked || isPending || Boolean(isRevealing);

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
        className="pointer-events-none absolute left-1/2 top-12 h-[420px] w-[640px] max-w-full -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, hsl(var(--brand) / 0.12), transparent 68%)" }}
      />

      <div className="relative flex min-h-full items-center justify-center px-4 py-3">
        <div
          className="relative w-full max-w-[640px] overflow-hidden rounded-xl border border-border-soft shadow-e3"
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

          {/* Dice well. */}
          <div className="px-5 py-3">
            <div
              className="relative flex items-center justify-center gap-5 overflow-hidden rounded-lg border border-border-soft bg-surface-0 px-4 py-4"
              style={{ boxShadow: "inset 0 2px 14px hsl(var(--surface-0) / 0.6)" }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 120%, hsl(var(--brand) / 0.14), transparent 60%)"
                }}
              />
              {/* The three-dice row (~340px) is uniformly scaled down on
                  phones so it never overflows the well; the dice tumble
                  physics are untouched (scale is a transform). */}
              <div className="relative h-[70px] w-[238px] sm:h-[100px] sm:w-[340px]">
                <div className="absolute left-0 top-0 flex origin-top-left items-center gap-5 scale-[0.7] sm:scale-100">
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
                </div>
              </div>

              {/* Frosted dome / dice cup */}
              <AnimatePresence>
                {covered ? (
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute bottom-3 left-1/2 z-10 h-20 w-64 rounded-b-lg rounded-t-full border border-border bg-surface-2/85 backdrop-blur-sm sm:h-28"
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

          <Divider />

          {/* Bet layout. */}
          <div className="px-5 py-3">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1.35fr]">
              <div className="grid grid-cols-2 gap-2">
                <TableBetButton
                  label={t("casino.room.selection.sicBo.kinds.small")}
                  detail={`${sicBoMultiplier("small", 0).toFixed(2)}x`}
                  active={betKind === "small"}
                  disabled={selectionDisabled}
                  onClick={() => onBetChange("small", 0)}
                />
                <TableBetButton
                  label={t("casino.room.selection.sicBo.kinds.big")}
                  detail={`${sicBoMultiplier("big", 0).toFixed(2)}x`}
                  active={betKind === "big"}
                  disabled={selectionDisabled}
                  onClick={() => onBetChange("big", 0)}
                />
                <TableBetButton
                  label={t("casino.room.selection.sicBo.kinds.anyTriple")}
                  detail={`${sicBoMultiplier("anyTriple", 0).toFixed(2)}x`}
                  active={betKind === "anyTriple"}
                  disabled={selectionDisabled}
                  onClick={() => onBetChange("anyTriple", 0)}
                  wide
                />

                <BetGroup label={t("casino.room.selection.sicBo.face")} className="col-span-2">
                  <div className="grid grid-cols-6 gap-1.5">
                    {FACE_VALUES.map((value) => (
                      <NumberBetButton
                        key={value}
                        value={value}
                        active={isSicBoActive(betKind, betValue, "singleFace", value)}
                        disabled={selectionDisabled}
                        onClick={() => onBetChange("singleFace", value)}
                        compact
                      />
                    ))}
                  </div>
                </BetGroup>
              </div>

              <div className="grid gap-3">
                <BetGroup
                  label={t("casino.room.selection.sicBo.kinds.total")}
                  trailing={
                    <span className="font-mono text-[10px] text-accent">
                      {t("casino.room.selection.sicBo.total")}
                    </span>
                  }
                >
                  <div className="grid grid-cols-7 gap-1.5">
                    {TOTAL_VALUES.map((value) => (
                      <NumberBetButton
                        key={value}
                        value={value}
                        active={isSicBoActive(betKind, betValue, "total", value)}
                        disabled={selectionDisabled}
                        onClick={() => onBetChange("total", value)}
                      />
                    ))}
                  </div>
                </BetGroup>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <BetGroup label={t("casino.room.selection.sicBo.kinds.specificDouble")}>
                    <div className="grid grid-cols-6 gap-1.5">
                      {FACE_VALUES.map((value) => (
                        <NumberBetButton
                          key={value}
                          value={value}
                          active={isSicBoActive(betKind, betValue, "specificDouble", value)}
                          disabled={selectionDisabled}
                          onClick={() => onBetChange("specificDouble", value)}
                          compact
                        />
                      ))}
                    </div>
                  </BetGroup>

                  <BetGroup label={t("casino.room.selection.sicBo.kinds.specificTriple")}>
                    <div className="grid grid-cols-6 gap-1.5">
                      {FACE_VALUES.map((value) => (
                        <NumberBetButton
                          key={value}
                          value={value}
                          active={isSicBoActive(betKind, betValue, "specificTriple", value)}
                          disabled={selectionDisabled}
                          onClick={() => onBetChange("specificTriple", value)}
                          compact
                        />
                      ))}
                    </div>
                  </BetGroup>
                </div>
              </div>
            </div>
          </div>

          <Divider />

          {/* Result + status. */}
          <div className="flex flex-col gap-3 px-5 py-3">
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-lg bg-surface-2 px-3 py-2.5 text-center ring-1 ring-inset ring-border-soft">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
                  {t("casino.room.stage.sicBo.total")}
                </p>
                <p className="mt-1 font-mono text-2xl font-bold text-fg">{roll?.total ?? "—"}</p>
              </div>
              <div className="rounded-lg bg-surface-2 px-3 py-2.5 text-center ring-1 ring-inset ring-border-soft">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
                  {t("casino.room.stage.sicBo.triple")}
                </p>
                <p className="mt-1 font-mono text-2xl font-bold text-fg">
                  {roll == null
                    ? "—"
                    : roll.triple
                      ? t("casino.room.selection.slots.yes")
                      : t("casino.room.selection.slots.no")}
                </p>
              </div>
              <div className="rounded-lg bg-surface-2 px-3 py-2.5 text-center ring-1 ring-inset ring-border-soft">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
                  {t("casino.room.stage.sicBo.result")}
                </p>
                <p
                  className={cn(
                    "mt-1 font-mono text-2xl font-bold",
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

            <div className="text-center" aria-live="polite">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-fg-subtle">
                {isPending || isRevealing
                  ? t("casino.room.stage.sicBo.rolling")
                  : hasResult
                    ? t("casino.room.stage.sicBo.opened", { dice: roll?.dice.join(" / ") ?? "—" })
                    : t("casino.room.stage.sicBo.ready")}
              </p>
              <p className="mt-0.5 font-mono text-sm font-bold uppercase tracking-widest text-fg">
                {formatSicBoBet(betKind, betValue, t)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
