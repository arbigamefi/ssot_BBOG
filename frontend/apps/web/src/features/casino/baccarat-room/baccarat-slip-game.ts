"use client";

import type { GameRoom } from "../room/use-game-room";
import type { SlipGame } from "../table-room/room-slip";
import { useBaccaratCopy } from "./baccarat-copy";
import { baccaratPayout, sideChance } from "./baccarat-model";

/** The baccarat bet as the slip and the receipt print it: the side, and what a win on it pays. */
export function useBaccaratSlipGame(room: GameRoom): SlipGame {
  const copy = useBaccaratCopy();
  const { t } = copy;
  const side = room.baccaratSide;
  const outcome = room.casinoOutcome?.kind === "baccarat" ? room.casinoOutcome : null;
  const hands = outcome?.rolls ?? [];

  return {
    id: "baccarat",
    line: t("slip.game", { side }),
    chance: sideChance(side),
    payout: (perRound, houseEdgeBps) => baccaratPayout(perRound, side, houseEdgeBps),
    receipt: {
      line: t("slip.game", { side: outcome?.side ?? side }),
      rolled:
        outcome && hands.length > 0
          ? {
              text: copy.cameText(hands, outcome.side),
              detail: copy.handLines(hands)
            }
          : null
    }
  };
}
