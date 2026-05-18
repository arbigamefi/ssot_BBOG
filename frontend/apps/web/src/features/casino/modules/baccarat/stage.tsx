import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import type { CasinoOutcome } from "../../room/outcome";
import type { BaccaratSide } from "../../room/params";

type BaccaratRoll = Extract<CasinoOutcome, { kind: "baccarat" }>["rolls"][number];

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
      <span className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">
        {value == null ? "—" : value === 0 ? "10/J/Q/K" : "A-9"}
      </span>
      <span className="mt-1 font-mono text-3xl font-black text-fg">{value ?? "—"}</span>
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
        "flex flex-col gap-4 rounded-xl border bg-surface-1 p-5 shadow-e2",
        winner ? "border-accent/60 bg-accent-soft" : "border-border"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-[0.2em] text-fg-subtle">
          {title}
        </span>
        <span className={cn("font-mono text-3xl font-black", winner ? "text-accent" : "text-fg")}>
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

export function BaccaratStage({
  isPending,
  showResult,
  selectedSide,
  outcome
}: {
  isPending: boolean;
  showResult: boolean;
  selectedSide: BaccaratSide;
  outcome?: Extract<CasinoOutcome, { kind: "baccarat" }> | null;
}) {
  const t = useTranslations();
  const roll: BaccaratRoll | undefined = outcome?.rolls.at(-1);
  const hasResult = Boolean(showResult && roll);
  const winner = roll?.outcome;

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center overflow-hidden p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--brand)/0.06)_0%,transparent_62%)]" />
      <div className="relative flex w-full max-w-4xl flex-col items-center gap-7">
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

        <div className="rounded-lg border border-border bg-surface-1/90 px-5 py-3 text-center shadow-e1 backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-fg-subtle">
            {isPending
              ? t("casino.room.stage.baccarat.dealing")
              : hasResult
                ? t("casino.room.stage.baccarat.result", {
                    side: formatSide(winner ?? "tie", t)
                  })
                : t("casino.room.stage.baccarat.ready")}
          </p>
          <p className="mt-1 font-mono text-sm font-black uppercase tracking-widest text-fg">
            {t("casino.room.stage.baccarat.selected", {
              side: formatSide(selectedSide, t)
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
