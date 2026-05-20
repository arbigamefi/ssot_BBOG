import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import type { CasinoOutcome } from "../../room/outcome";
import { baccaratMultiplier, type BaccaratSide } from "../../room/params";

type BaccaratRoll = Extract<CasinoOutcome, { kind: "baccarat" }>["rolls"][number];
const BACCARAT_SIDES: readonly BaccaratSide[] = ["player", "banker", "tie"] as const;
const CARD_SUITS = [
  {
    className: "text-fg",
    path: "M12 3c-2.9 3.1-6.4 5.4-6.4 9.1 0 2.5 1.7 4.2 4 4.2.9 0 1.7-.3 2.4-.8-.2 1.5-.8 2.9-1.8 4.2h3.6c-1-1.3-1.6-2.7-1.8-4.2.7.5 1.5.8 2.4.8 2.3 0 4-1.7 4-4.2C18.4 8.4 14.9 6.1 12 3Z"
  },
  {
    className: "text-danger",
    path: "M12 20s-7.2-4.4-7.2-10.1C4.8 6.9 6.7 5 9.2 5c1.2 0 2.3.6 2.8 1.5C12.5 5.6 13.6 5 14.8 5c2.5 0 4.4 1.9 4.4 4.9C19.2 15.6 12 20 12 20Z"
  },
  {
    className: "text-danger",
    path: "M12 3 19 12 12 21 5 12 12 3Z"
  },
  {
    className: "text-fg",
    path: "M9.1 10.8A3.2 3.2 0 1 1 12 8.9a3.2 3.2 0 1 1 2.9 1.9 3.2 3.2 0 1 1-3.3 4.8c-.1 1.5-.7 2.8-1.7 4.1h4.2c-1-1.3-1.6-2.6-1.7-4.1a3.2 3.2 0 1 1-3.3-4.8Z"
  }
] as const;

function formatSide(side: BaccaratSide, t: ReturnType<typeof useTranslations>) {
  return t(`casino.room.selection.baccarat.${side}`);
}

function CardSuitIcon({ suitIndex }: { suitIndex: number }) {
  const suit = CARD_SUITS[suitIndex % CARD_SUITS.length] ?? CARD_SUITS[0];

  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={cn("h-8 w-8 drop-shadow-md", suit.className)}
      fill="currentColor"
    >
      <path d={suit.path} />
    </svg>
  );
}

function CardFace({
  value,
  active,
  dealing,
  suitIndex
}: {
  value: number | undefined;
  active: boolean;
  dealing?: boolean;
  suitIndex: number;
}) {
  const label = value == null ? "—" : value === 0 ? "10" : String(value);

  return (
    <div
      className={cn(
        "relative flex h-28 w-20 flex-col items-center justify-center overflow-hidden rounded-xl border shadow-inner-e1 transition-[border-color,background-color,transform]",
        active ? "border-brand/50 bg-brand-soft" : "border-border",
        value == null ? "bg-surface-2" : "bg-fg",
        dealing && "animate-[baccarat-card-deal_360ms_ease-out] border-brand/40 bg-brand-soft"
      )}
      aria-label={value == null ? "Unrevealed card" : `Card value ${value}`}
    >
      {value == null ? (
        <>
          <span className="absolute inset-2 rounded-lg border border-border-soft bg-brand-soft" />
          <span className="absolute left-3 top-3 h-2 w-2 rounded-full bg-brand/70" />
          <span className="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-brand/70" />
          <span className="relative h-10 w-7 rounded-md border border-brand/30 bg-surface-0/40 shadow-inner-e1" />
        </>
      ) : (
        <>
          <span className="absolute left-2 top-2 font-mono text-sm font-semibold text-surface-0">
            {label}
          </span>
          <span className="absolute bottom-2 right-2 rotate-180 font-mono text-sm font-semibold text-surface-0">
            {label}
          </span>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-0/10">
            <CardSuitIcon suitIndex={suitIndex} />
          </span>
        </>
      )}
    </div>
  );
}

function HandPanel({
  title,
  suitOffset,
  cards,
  total,
  winner,
  revealed
}: {
  title: string;
  suitOffset: number;
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
          <CardFace
            key={index}
            value={cards[index]}
            active={winner && cards[index] != null}
            dealing={revealed === index + 1 && cards[index] != null}
            suitIndex={suitOffset + index}
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
            suitOffset={0}
            cards={visiblePlayerCards}
            total={hasResult ? roll?.playerTotal : undefined}
            winner={winner === "player"}
            revealed={playerRevealed}
          />
          <HandPanel
            title={formatSide("banker", t)}
            suitOffset={2}
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
