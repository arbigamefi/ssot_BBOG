import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import type { CasinoOutcome } from "../../room/outcome";
import { baccaratMultiplier, type BaccaratSide } from "../../room/params";

type BaccaratRoll = Extract<CasinoOutcome, { kind: "baccarat" }>["rolls"][number];
const BACCARAT_SIDES: readonly BaccaratSide[] = ["player", "banker", "tie"] as const;

function formatSide(side: BaccaratSide, t: ReturnType<typeof useTranslations>) {
  return t(`casino.room.selection.baccarat.${side}`);
}

function CardPip({
  value,
  active,
  dealing
}: {
  value: number | undefined;
  active: boolean;
  dealing?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-24 w-16 flex-col items-center justify-center rounded-lg border bg-surface-2 shadow-inner-e1 transition-[border-color,background-color,transform]",
        active ? "border-brand/50 bg-brand-soft" : "border-border",
        dealing && "animate-[baccarat-card-deal_360ms_ease-out] border-brand/40 bg-brand-soft"
      )}
    >
      <span className="text-[9px] font-semibold uppercase tracking-widest text-fg-subtle">
        {value == null ? "—" : value === 0 ? "10/J/Q/K" : "A-9"}
      </span>
      <span className="mt-1 font-mono text-3xl font-semibold text-fg">{value ?? "—"}</span>
    </div>
  );
}

function HandPanel({
  title,
  cards,
  total,
  winner,
  revealed
}: {
  title: string;
  cards: readonly (number | undefined)[];
  total: number | undefined;
  winner: boolean;
  revealed: number;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-surface-1 p-4 shadow-e2",
        winner ? "border-accent/60 bg-accent-soft" : "border-border"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-fg-subtle">
          {title}
        </span>
        <span
          className={cn("font-mono text-3xl font-semibold", winner ? "text-accent" : "text-fg")}
        >
          {total ?? "—"}
        </span>
      </div>
      <div className="flex gap-3">
        {[0, 1, 2].map((index) => (
          <CardPip
            key={index}
            value={cards[index]}
            active={winner && cards[index] != null}
            dealing={revealed === index + 1 && cards[index] != null}
          />
        ))}
      </div>
    </div>
  );
}

function BettingSideButton({
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
      className={cn(
        "group min-h-28 rounded-xl border px-4 py-4 text-left transition-colors",
        active
          ? "border-brand bg-brand-soft text-fg"
          : "border-border bg-surface-1 text-fg-muted hover:border-brand/50 hover:bg-surface-2 hover:text-fg",
        disabled && "cursor-not-allowed opacity-70"
      )}
      aria-pressed={active}
    >
      <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-fg-subtle">
        {t("casino.room.selection.baccarat.betOn")}
      </span>
      <span className="mt-2 block text-xl font-semibold">{formatSide(side, t)}</span>
      <span className="mt-3 block font-mono text-sm text-accent">
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
  const prefersReducedMotion = useReducedMotion();
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
  const [revealedCards, setRevealedCards] = React.useState(() =>
    showResult && roll ? dealOrder.length : 0
  );
  const dealComplete = Boolean(roll && revealedCards >= dealOrder.length);
  const hasResult = Boolean(showResult && roll && (dealComplete || !isRevealing));
  const winner = roll?.outcome;
  const visiblePlayerCards =
    roll?.playerCards.map((card, index) =>
      dealOrder.findIndex((item) => item.side === "player" && item.index === index) < revealedCards
        ? card
        : undefined
    ) ?? [];
  const visibleBankerCards =
    roll?.bankerCards.map((card, index) =>
      dealOrder.findIndex((item) => item.side === "banker" && item.index === index) < revealedCards
        ? card
        : undefined
    ) ?? [];
  const playerRevealed = visiblePlayerCards.filter((card) => card != null).length;
  const bankerRevealed = visibleBankerCards.filter((card) => card != null).length;

  React.useEffect(() => {
    if (!isRevealing || !roll || dealOrder.length === 0) {
      setRevealedCards(showResult && roll ? dealOrder.length : 0);
      return;
    }

    setRevealedCards(0);
    const timeouts: number[] = [];
    const schedule = (callback: () => void, delay: number) => {
      const timeout = window.setTimeout(callback, delay);
      timeouts.push(timeout);
    };

    if (prefersReducedMotion) {
      setRevealedCards(dealOrder.length);
      schedule(() => onRevealComplete?.(), 180);
      return () => {
        timeouts.forEach((timeout) => window.clearTimeout(timeout));
      };
    }

    dealOrder.forEach((_, index) => {
      schedule(() => setRevealedCards(index + 1), 260 + index * 520);
    });
    schedule(() => onRevealComplete?.(), 260 + dealOrder.length * 520 + 320);

    return () => {
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [dealOrder, isRevealing, onRevealComplete, prefersReducedMotion, roll, showResult]);

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-start overflow-hidden px-6 pb-6 pt-24">
      <div className="relative flex w-full max-w-4xl flex-col items-center gap-5">
        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
          <HandPanel
            title={formatSide("player", t)}
            cards={visiblePlayerCards}
            total={hasResult ? roll?.playerTotal : undefined}
            winner={winner === "player"}
            revealed={playerRevealed}
          />
          <HandPanel
            title={formatSide("banker", t)}
            cards={visibleBankerCards}
            total={hasResult ? roll?.bankerTotal : undefined}
            winner={winner === "banker"}
            revealed={bankerRevealed}
          />
        </div>

        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-3">
          {BACCARAT_SIDES.map((side) => (
            <BettingSideButton
              key={side}
              side={side}
              active={side === selectedSide}
              disabled={isPending}
              onClick={() => onSideChange(side)}
              t={t}
            />
          ))}
        </div>

        <div className="w-full rounded-lg border border-border bg-surface-1/90 px-5 py-3 text-center shadow-e1 backdrop-blur">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-fg-subtle">
            {isPending || isRevealing
              ? t("casino.room.stage.baccarat.dealing")
              : hasResult
                ? t("casino.room.stage.baccarat.result", {
                    side: formatSide(winner ?? "tie", t)
                  })
                : t("casino.room.stage.baccarat.ready")}
          </p>
          <p className="mt-1 font-mono text-sm font-semibold uppercase tracking-widest text-fg">
            {t("casino.room.stage.baccarat.selected", {
              side: formatSide(selectedSide, t)
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
