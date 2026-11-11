"use client";

import type { GameRoom } from "../room/use-game-room";
import type { SlipGame } from "../table-room/room-slip";
import { useCoinCopy, type Flip } from "./coin-copy";
import { COIN_CHANCE, coinPayout, sideKey } from "./coin-model";

/** The coin toss bet as the slip and the receipt print it: the call, and what a match pays. */
export function useCoinSlipGame(room: GameRoom): SlipGame {
  const copy = useCoinCopy();
  const { t } = copy;
  const outcome = room.casinoOutcome?.kind === "coin-toss" ? room.casinoOutcome : null;
  const flips: Flip[] =
    outcome?.rolls.map((roll) => ({ tails: roll.value === "TAILS", match: roll.won })) ?? [];

  return {
    id: "coin",
    line: t("slip.game", { face: sideKey(room.coinSide) }),
    chance: COIN_CHANCE,
    payout: coinPayout,
    lines: [{ label: t("slip.match"), payout: coinPayout }],
    receipt: {
      line: t("slip.game", { face: sideKey(outcome?.chosen ?? room.coinSide) }),
      rolled:
        outcome && flips.length > 0
          ? {
              text: copy.landedText(flips, outcome.chosen),
              print: copy.landedPrint(flips, outcome.chosen)
            }
          : null
    }
  };
}
