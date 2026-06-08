import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import type { CasinoOutcome } from "../../room/outcome";
import { baccaratMultiplier, type BaccaratSide } from "../../room/params";
import { BaccaratCard, EmptyCardSlot } from "./baccarat-card";

/**
 * BaccaratStage — a baccarat table inside the shared game console.
 *
 * The felt keeps a dealing shoe, PLAYER / BANKER hand zones and on-felt betting
 * boxes. The deal order, card flip lifecycle and VRF reveal state machine are
 * unchanged — only the cabinet chrome was rebuilt into the console language.
 */

type BaccaratRoll = Extract<CasinoOutcome, { kind: "baccarat" }>["rolls"][number];
type SlotState = "empty" | "back" | "face";

const BACCARAT_SIDES: readonly BaccaratSide[] = ["player", "banker", "tie"] as const;

// Entrance stagger so the four face-down cards deal one at a time.
const SLOT_DEAL_DELAY: Record<string, number> = {
  "player-0": 0,
  "banker-0": 90,
  "player-1": 180,
  "banker-1": 270,
  "player-2": 360,
  "banker-2": 450
};

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

function formatSide(side: BaccaratSide, t: ReturnType<typeof useTranslations>) {
  return t(`casino.room.selection.baccarat.${side}`);
}

type HandSlot = { state: SlotState; value: number | undefined; dealDelayMs: number };

function HandZone({
  hand,
  title,
  suitOffset,
  slots,
  total,
  winner,
  instant
}: {
  hand: "player" | "banker";
  title: string;
  suitOffset: number;
  slots: readonly HandSlot[];
  total: number | undefined;
  winner: boolean;
  instant: boolean;
}) {
  const faceCount = slots.filter((slot) => slot.state === "face").length;
  return (
    <div
      data-baccarat-hand={hand}
      data-winner={winner ? "true" : "false"}
      style={
        winner
          ? {
              boxShadow:
                "0 0 0 1px hsl(var(--accent) / 0.55), 0 10px 26px -8px hsl(var(--accent) / 0.45)"
            }
          : undefined
      }
      className={cn(
        "relative flex flex-col items-center gap-2 rounded-lg p-2 transition-[box-shadow,background-color] sm:gap-3 sm:rounded-xl sm:p-3",
        winner
          ? "bg-accent-soft ring-1 ring-inset ring-accent/60"
          : "bg-surface-0/50 ring-1 ring-inset ring-border-soft"
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-fg-subtle sm:text-[11px] sm:tracking-[0.32em]">
        {title}
      </span>
      <div className="flex gap-1 sm:gap-1.5">
        {slots.map((slot, index) =>
          slot.state === "empty" ? (
            <EmptyCardSlot key={index} />
          ) : (
            <BaccaratCard
              key={index}
              value={slot.value}
              suitIndex={suitOffset + index}
              faceUp={slot.state === "face"}
              instant={instant}
              dealDelayMs={slot.dealDelayMs}
            />
          )
        )}
      </div>
      <span
        className={cn(
          "font-mono text-xl font-bold tabular-nums sm:text-3xl",
          winner ? "text-accent" : "text-fg"
        )}
      >
        {total ?? "—"}
      </span>
      <span className="sr-only">{`${title} revealed ${faceCount}`}</span>
    </div>
  );
}

function DealingShoe({ active, reduced }: { active: boolean; reduced: boolean }) {
  return (
    <div
      aria-hidden
      className="absolute right-4 top-3 h-12 w-16"
      style={{ transform: "skewX(-12deg)" }}
    >
      <div className="absolute inset-0 rounded-md border border-border bg-surface-2 shadow-e2" />
      {active && !reduced ? (
        <motion.div
          className="absolute inset-0 rounded-md ring-1 ring-brand"
          animate={{ opacity: [0.15, 0.65, 0.15] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}
      {/* Card peeking from the shoe mouth */}
      <motion.div
        className="absolute bottom-1.5 left-1/2 h-7 w-9 rounded-sm border border-brand/30 bg-surface-0/80"
        style={{ marginLeft: -18 }}
        animate={active && !reduced ? { y: [0, 4, 0] } : { y: 0 }}
        transition={
          active && !reduced
            ? { duration: 0.95, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.2 }
        }
      />
    </div>
  );
}

function BetBox({
  side,
  active,
  disabled,
  onClick,
  t
}: {
  side: BaccaratSide;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative flex flex-col items-center gap-1 rounded-lg px-4 py-3 transition-[transform,box-shadow,background-color]",
        active
          ? "-translate-y-0.5 bg-brand-soft shadow-glow ring-1 ring-inset ring-brand"
          : "bg-surface-3 shadow-e1 ring-1 ring-inset ring-border-soft",
        !active && !disabled && "hover:-translate-y-0.5 hover:shadow-e2 hover:ring-brand/40",
        disabled && "cursor-default opacity-60"
      )}
    >
      <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-fg-subtle">
        {t("casino.room.selection.baccarat.betOn")}
      </span>
      <span className={cn("text-base font-bold", active ? "text-fg" : "text-fg-muted")}>
        {formatSide(side, t)}
      </span>
      <span className="font-mono text-xs text-accent">
        {baccaratMultiplier(side).toFixed(side === "tie" ? 2 : 3)}x
      </span>
    </button>
  );
}

export function BaccaratStage({
  isPending,
  controlsLocked = false,
  isRevealing,
  showResult,
  selectedSide,
  onSideChange,
  outcome,
  onRevealComplete
}: {
  isPending: boolean;
  controlsLocked?: boolean;
  isRevealing?: boolean;
  showResult: boolean;
  selectedSide: BaccaratSide;
  onSideChange: (side: BaccaratSide) => void;
  outcome?: Extract<CasinoOutcome, { kind: "baccarat" }> | null;
  onRevealComplete?: () => void;
}) {
  const t = useTranslations();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const roll: BaccaratRoll | undefined = outcome?.rolls.at(-1);
  const dealOrder = React.useMemo(() => {
    if (!roll) return [];
    return [
      { side: "player" as const, index: 0 },
      { side: "banker" as const, index: 0 },
      { side: "player" as const, index: 1 },
      { side: "banker" as const, index: 1 },
      ...(roll.playerCards[2] != null ? [{ side: "player" as const, index: 2 }] : []),
      ...(roll.bankerCards[2] != null ? [{ side: "banker" as const, index: 2 }] : [])
    ];
  }, [roll]);

  // revealedCards = how many cards have been turned face-up during the reveal.
  const [revealedCards, setRevealedCards] = React.useState(() =>
    showResult && roll ? dealOrder.length : 0
  );
  const dealComplete = Boolean(roll && revealedCards >= dealOrder.length);
  const hasResult = Boolean(showResult && roll && (dealComplete || !isRevealing));
  const winner = roll?.outcome;
  const instantCards = Boolean(showResult && roll && !isRevealing);
  const dealingActive = isPending || Boolean(isRevealing);
  const selectionDisabled = controlsLocked || isPending || Boolean(isRevealing);

  const slotState = (side: "player" | "banker", index: number): SlotState => {
    // VRF pending: the four base cards sit face-down, no third card yet.
    if (isPending) return index < 2 ? "back" : "empty";
    if (!roll) return "empty";
    const exists = (side === "player" ? roll.playerCards : roll.bankerCards)[index] != null;
    if (!exists) return "empty";
    if (showResult && !isRevealing) return "face";
    if (isRevealing) {
      const position = dealOrder.findIndex((item) => item.side === side && item.index === index);
      if (position >= 0 && revealedCards > position) return "face";
      return index < 2 ? "back" : "empty";
    }
    return "empty";
  };

  const slotsFor = (side: "player" | "banker"): HandSlot[] =>
    [0, 1, 2].map((index) => ({
      state: slotState(side, index),
      value: (side === "player" ? roll?.playerCards : roll?.bankerCards)?.[index],
      dealDelayMs: SLOT_DEAL_DELAY[`${side}-${index}`] ?? 0
    }));

  const playerSlots = slotsFor("player");
  const bankerSlots = slotsFor("banker");

  // VRF reveal state machine — turn the cards over one by one, then complete.
  React.useEffect(() => {
    if (!isRevealing || !roll || dealOrder.length === 0) {
      setRevealedCards(showResult && roll ? dealOrder.length : 0);
      return;
    }

    setRevealedCards(0);
    const timeouts: number[] = [];
    const schedule = (callback: () => void, delay: number) => {
      timeouts.push(window.setTimeout(callback, delay));
    };

    if (prefersReducedMotion) {
      setRevealedCards(dealOrder.length);
      schedule(() => onRevealComplete?.(), 180);
      return () => timeouts.forEach((timeout) => window.clearTimeout(timeout));
    }

    dealOrder.forEach((_, index) => {
      schedule(() => setRevealedCards(index + 1), 280 + index * 520);
    });
    schedule(() => onRevealComplete?.(), 280 + dealOrder.length * 520 + 320);

    return () => timeouts.forEach((timeout) => window.clearTimeout(timeout));
  }, [dealOrder, isRevealing, onRevealComplete, prefersReducedMotion, roll, showResult]);

  const statusText =
    isPending || isRevealing
      ? t("casino.room.stage.baccarat.dealing")
      : hasResult
        ? t("casino.room.stage.baccarat.result", { side: formatSide(winner ?? "tie", t) })
        : t("casino.room.stage.baccarat.ready");

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

      <div className="relative flex min-h-full items-start justify-center px-4 py-3 sm:items-center sm:py-4">
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

          {/* Felt — recessed table with hands and betting boxes. */}
          <div className="px-3 py-3 sm:px-5 sm:py-5">
            <div
              className="relative overflow-hidden rounded-lg border border-border-soft bg-surface-0 p-2.5 sm:p-3"
              style={{ boxShadow: "inset 0 2px 14px hsl(var(--surface-0) / 0.55)" }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 0%, hsl(var(--brand) / 0.1), transparent 62%)"
                }}
              />

              <DealingShoe active={dealingActive} reduced={prefersReducedMotion} />

              <div className="relative grid grid-cols-2 gap-2 sm:gap-3">
                <HandZone
                  hand="player"
                  title={formatSide("player", t)}
                  suitOffset={0}
                  slots={playerSlots}
                  total={hasResult ? roll?.playerTotal : undefined}
                  winner={hasResult && winner === "player"}
                  instant={instantCards}
                />
                <HandZone
                  hand="banker"
                  title={formatSide("banker", t)}
                  suitOffset={2}
                  slots={bankerSlots}
                  total={hasResult ? roll?.bankerTotal : undefined}
                  winner={hasResult && winner === "banker"}
                  instant={instantCards}
                />
              </div>

              <div className="relative mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-2.5">
                {BACCARAT_SIDES.map((side) => (
                  <BetBox
                    key={side}
                    side={side}
                    active={side === selectedSide}
                    disabled={selectionDisabled}
                    onClick={() => onSideChange(side)}
                    t={t}
                  />
                ))}
              </div>
            </div>
          </div>

          <Divider />

          {/* Status readout. */}
          <div className="px-5 py-3.5 text-center" aria-live="polite">
            <p
              className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.22em]",
                hasResult && winner && winner === selectedSide ? "text-accent" : "text-fg-subtle"
              )}
            >
              {statusText}
            </p>
            <p className="mt-0.5 font-mono text-sm font-bold uppercase tracking-widest text-fg">
              {t("casino.room.stage.baccarat.selected", { side: formatSide(selectedSide, t) })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
