import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import { RED_NUMBER_SET } from "./model";

export type GameHistoryEntry = {
  val: number;
  win: boolean;
};

export type RecentBetSummary = {
  id: string;
  betId: string | number | bigint;
  state: string;
};

type Translate = ReturnType<typeof useTranslations>;

function getRecentLabel(gameSlug: string, t: Translate) {
  if (gameSlug === "dice") return t("casino.room.history.recent.rolls");
  if (gameSlug === "roulette") return t("casino.room.history.recent.numbers");
  if (gameSlug === "keno") return t("casino.room.history.recent.draws");
  if (gameSlug === "plinko") return t("casino.room.history.recent.slots");
  return t("casino.room.history.recent.flips");
}

function getBetStateLabel(state: string, t: Translate) {
  if (state === "finalized") return t("casino.room.history.states.settled");
  if (state === "refunded") return t("casino.room.history.states.refunded");
  if (state === "randomReady") return t("casino.room.history.states.vrfReady");
  return t("casino.room.history.states.placed");
}

function getBetStateClass(state: string) {
  if (state === "finalized") return "border-success/25 bg-success-soft text-success";
  if (state === "refunded") return "border-border bg-surface-2 text-fg-muted";
  if (state === "randomReady") return "border-warn/25 bg-warn-soft text-warn";
  return "border-brand/25 bg-brand-soft text-brand";
}

function HistoryValue({ gameSlug, value }: { gameSlug: string; value: number }) {
  if (gameSlug === "coin-toss") return value === 1 ? "H" : "T";
  if (gameSlug === "keno") return value;
  if (gameSlug === "roulette") {
    return (
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full text-[8px]",
          value === 0 ? "bg-success" : RED_NUMBER_SET.has(value) ? "bg-danger" : "bg-surface-3"
        )}
      >
        {value}
      </span>
    );
  }
  return value;
}

export function GameRoomHistoryWidget({
  gameSlug,
  gameHistory,
  recentBets
}: {
  gameSlug: string;
  gameHistory: readonly GameHistoryEntry[];
  recentBets: readonly RecentBetSummary[];
}) {
  const t = useTranslations();

  return (
    <div className="absolute top-6 right-6 lg:top-8 lg:right-8 z-20 hidden md:block">
      <div className="flex min-w-[200px] max-w-[260px] flex-col items-end gap-2 rounded-lg border border-border bg-surface-1/90 p-3 shadow-e2 backdrop-blur-xl">
        <div className="w-full px-1 text-[10px] font-bold uppercase tracking-widest text-fg-subtle">
          {getRecentLabel(gameSlug, t)}
        </div>
        {gameHistory.length > 0 && (
          <div className="flex gap-1.5 justify-end flex-wrap w-full">
            {gameHistory.map((res, i) => (
              <div
                key={i}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border font-mono text-[9px] font-bold",
                  res.win
                    ? "border-success/50 bg-success-soft text-success"
                    : "border-danger/25 bg-danger-soft text-danger"
                )}
              >
                <HistoryValue gameSlug={gameSlug} value={res.val} />
              </div>
            ))}
          </div>
        )}
        {recentBets.length > 0 && (
          <div className="mt-1 flex w-full flex-col gap-1 border-t border-border-soft pt-2">
            {recentBets.slice(0, 3).map((bet) => (
              <div key={bet.id} className="flex justify-between items-center">
                <span className="font-mono text-[9px] text-fg-subtle">
                  #{bet.betId.toString().slice(-6)}
                </span>
                <span
                  className={cn(
                    "text-[9px] font-bold px-2 py-0.5 rounded-full border",
                    getBetStateClass(bet.state)
                  )}
                >
                  {getBetStateLabel(bet.state, t)}
                </span>
              </div>
            ))}
          </div>
        )}
        {gameHistory.length === 0 && recentBets.length === 0 && (
          <span className="px-2 py-1 text-[10px] text-fg-subtle">
            {t("casino.room.history.empty")}
          </span>
        )}
      </div>
    </div>
  );
}
