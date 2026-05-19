import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import type { CasinoOutcome } from "../../room/outcome";
import { baccaratMultiplier, type BaccaratSide } from "../../room/params";

type BaccaratRoll = Extract<CasinoOutcome, { kind: "baccarat" }>["rolls"][number];
const BACCARAT_SIDES: readonly BaccaratSide[] = ["player", "banker", "tie"] as const;

function formatSide(side: BaccaratSide, t: ReturnType<typeof useTranslations>) {
  return t(`casino.room.selection.baccarat.${side}`);
}

function CardPip({ value, active }: { value: number | undefined; active: boolean }) {
  return (
    <div
      className={cn(
        "flex h-24 w-16 flex-col items-center justify-center rounded-lg border bg-surface-2 shadow-inner-e1",
        active ? "border-brand/50 bg-brand-soft" : "border-border"
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
  winner
}: {
  title: string;
  cards: readonly number[];
  total: number | undefined;
  winner: boolean;
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
          <CardPip key={index} value={cards[index]} active={winner && cards[index] != null} />
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
  showResult,
  selectedSide,
  onSideChange,
  outcome
}: {
  isPending: boolean;
  showResult: boolean;
  selectedSide: BaccaratSide;
  onSideChange: (side: BaccaratSide) => void;
  outcome?: Extract<CasinoOutcome, { kind: "baccarat" }> | null;
}) {
  const t = useTranslations();
  const roll: BaccaratRoll | undefined = outcome?.rolls.at(-1);
  const hasResult = Boolean(showResult && roll);
  const winner = roll?.outcome;

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-start overflow-hidden px-6 pb-6 pt-24">
      <div className="relative flex w-full max-w-4xl flex-col items-center gap-5">
        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
          <HandPanel
            title={formatSide("player", t)}
            cards={roll?.playerCards ?? []}
            total={roll?.playerTotal}
            winner={winner === "player"}
          />
          <HandPanel
            title={formatSide("banker", t)}
            cards={roll?.bankerCards ?? []}
            total={roll?.bankerTotal}
            winner={winner === "banker"}
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
            {isPending
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
