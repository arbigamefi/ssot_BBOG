import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import type { CasinoOutcome } from "../../room/outcome";
import { baccaratMultiplier, type BaccaratSide } from "../../room/params";
import { BaccaratCard, EmptyCardSlot } from "./baccarat-card";

/**
 * BaccaratStage — a baccarat table with a full round lifecycle.
 *
 * Stage realism: a felt table with a raised rail, a dealing shoe, stencilled
 * PLAYER / BANKER zones, and on-felt betting boxes.
 *
 * Animation realism, beat by beat:
 *   - bet placed / VRF pending → four cards are dealt face-down out of the
 *     shoe into the zones, and the shoe glows with a card peeking from it;
 *   - VRF ready / revealing    → the croupier turns the cards one by one, any
 *     third card is drawn, then the winning zone lights up;
 *   - resolved on load         → cards mount face-up with no animation.
 *
 * The deal order, reveal timing, and VRF state machine are preserved.
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

function formatSide(side: BaccaratSide, t: ReturnType<typeof useTranslations>) {
  return t(`casino.room.selection.baccarat.${side}`);
}

type HandSlot = { state: SlotState; value: number | undefined; dealDelayMs: number };

function HandZone({
  title,
  suitOffset,
  slots,
  total,
  winner,
  instant
}: {
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
      className={cn(
        "relative flex flex-col items-center gap-3 rounded-xl border p-4 transition-colors",
        winner
          ? "border-accent/60 bg-accent-soft shadow-glow"
          : "border-border-soft bg-surface-0/40"
      )}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-fg-subtle">
        {title}
      </span>
      <div className="flex gap-2.5">
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
          "font-mono text-3xl font-semibold tabular-nums",
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
      <div className="absolute inset-0 rounded-md border border-border-strong bg-surface-2 shadow-e2" />
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
        "group relative flex flex-col items-center gap-1 rounded-xl border-2 px-4 py-3 transition-colors",
        active
          ? "border-brand bg-brand-soft text-fg"
          : "border-dashed border-border-strong bg-surface-0/50 text-fg-muted hover:border-brand/55 hover:text-fg",
        disabled && "cursor-not-allowed opacity-70"
      )}
    >
      <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-fg-subtle">
        {t("casino.room.selection.baccarat.betOn")}
      </span>
      <span className="text-base font-semibold">{formatSide(side, t)}</span>
      <span className="font-mono text-xs text-accent">
        {baccaratMultiplier(side).toFixed(side === "tie" ? 2 : 3)}x
      </span>
    </button>
  );
}

export function BaccaratStage({
  isPending,
  isRevealing,
  showResult,
  selectedSide,
  onSideChange,
  outcome,
  onRevealComplete
}: {
  isPending: boolean;
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
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 overflow-hidden px-6 py-8">
      {/* ---- Felt table ---- */}
      <div className="relative w-full max-w-3xl">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-5 left-1/2 h-9 w-3/4 -translate-x-1/2 rounded-full bg-surface-0/45 blur-2xl"
        />

        {/* table rail */}
        <div className="relative rounded-xl border-4 border-border-strong bg-surface-1 p-2 shadow-e3">
          {/* felt surface */}
          <div className="relative overflow-hidden rounded-lg border border-border bg-surface-0 p-5 shadow-inner-e1">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 0%, hsl(var(--brand) / 0.1), transparent 62%)"
              }}
            />

            <DealingShoe active={dealingActive} reduced={prefersReducedMotion} />

            {/* hands */}
            <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2">
              <HandZone
                title={formatSide("player", t)}
                suitOffset={0}
                slots={playerSlots}
                total={hasResult ? roll?.playerTotal : undefined}
                winner={winner === "player"}
                instant={instantCards}
              />
              <HandZone
                title={formatSide("banker", t)}
                suitOffset={2}
                slots={bankerSlots}
                total={hasResult ? roll?.bankerTotal : undefined}
                winner={winner === "banker"}
                instant={instantCards}
              />
            </div>

            {/* on-felt betting boxes */}
            <div className="relative mt-5 grid grid-cols-3 gap-3">
              {BACCARAT_SIDES.map((side) => (
                <BetBox
                  key={side}
                  side={side}
                  active={side === selectedSide}
                  disabled={isPending}
                  onClick={() => onSideChange(side)}
                  t={t}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ---- Status readout ---- */}
      <div
        className={cn(
          "rounded-lg border bg-surface-1 px-5 py-2.5 text-center shadow-e1",
          hasResult && winner && winner === selectedSide ? "border-accent/45" : "border-border"
        )}
        aria-live="polite"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-fg-subtle">
          {statusText}
        </p>
        <p className="mt-0.5 font-mono text-sm font-semibold uppercase tracking-widest text-fg">
          {t("casino.room.stage.baccarat.selected", { side: formatSide(selectedSide, t) })}
        </p>
      </div>
    </div>
  );
}
