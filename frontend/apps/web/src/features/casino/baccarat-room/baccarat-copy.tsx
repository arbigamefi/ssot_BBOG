"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { BaccaratSide } from "../room/params";
import { ranksOf, suitOf, suitsOf, type BaccaratHand, type HandSide } from "./baccarat-model";
import { CardMark } from "./playing-card";

/**
 * The baccarat words: a side ("Banker"), a hand's result as a sentence ("Banker wins, 9 to 6."),
 * and a bet's result for the receipt and screen readers ("Banker wins, 9 to 6. You backed Banker.").
 * On paper the last hand's cards print under it, rank and suit, red for hearts and diamonds.
 */
export function useBaccaratCopy() {
  const t = useTranslations("casino.baccarat");
  return React.useMemo(() => {
    const side = (value: BaccaratSide) => t(`table.side.${value}`);
    const result = (hand: BaccaratHand) =>
      t("table.result", {
        winner: hand.outcome,
        player: hand.playerTotal,
        banker: hand.bankerTotal
      });
    const cameText = (hands: readonly BaccaratHand[], backed: BaccaratSide) => {
      const last = hands.at(-1);
      if (!last) return "";
      return hands.length > 1
        ? t("receipt.cameMany", {
            result: result(last),
            hits: hands.filter((hand) => hand.won).length,
            n: hands.length
          })
        : t("receipt.came", { result: result(last), side: side(backed) });
    };
    /** The last hand's two sides as printed lines: "Player  A♥ 4♠ 5♦  9". */
    const handLines = (hands: readonly BaccaratHand[]): React.ReactNode => {
      const last = hands.at(-1);
      if (!last) return null;
      const suits = suitsOf(last);
      return (
        <span className="mt-1 grid gap-0.5 font-normal">
          {hands.length > 1 ? (
            <span className="text-note text-faded">{t("receipt.last")}</span>
          ) : null}
          {(["player", "banker"] as const).map((hand: HandSide) => (
            <span key={hand} className="flex items-baseline gap-x-1.5">
              <span className="min-w-[4.5em] text-faded">{t(`table.hand.${hand}`)}</span>
              {ranksOf(last, hand).map((rank, k) => (
                <CardMark key={k} rank={rank} suit={suitOf(suits, hand, k)} />
              ))}
              <b className="ml-auto font-semibold tabular-nums">
                {hand === "player" ? last.playerTotal : last.bankerTotal}
              </b>
            </span>
          ))}
        </span>
      );
    };
    return { t, side, result, cameText, handLines };
  }, [t]);
}
