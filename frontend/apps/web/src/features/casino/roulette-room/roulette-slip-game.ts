"use client";

import { rouletteCoveredNumbers } from "../room/params";
import type { GameRoom } from "../room/use-game-room";
import type { SlipGame } from "../table-room/room-slip";
import { useRouletteCopy } from "./roulette-copy";
import {
  numberRuns,
  rouletteChance,
  roulettePayout,
  rouletteSelection,
  spotsMatch
} from "./roulette-model";

/** The roulette bet as the slip and the receipt print it. */
export function useRouletteSlipGame(room: GameRoom): SlipGame {
  const copy = useRouletteCopy();
  const { t } = copy;
  const spots = room.rouletteSpots;
  const covered = rouletteCoveredNumbers(spots);
  const k = covered.length;
  const selection = rouletteSelection(k);
  const covers = (numbers: readonly number[]) => t("slip.covers", { numbers: numberRuns(numbers) });

  // The receipt names the bet by the chips on the table when they are the bet that settled;
  // otherwise, as after a reload, by the numbers it covered.
  const outcome = room.casinoOutcome?.kind === "roulette" ? room.casinoOutcome : null;
  const selected = outcome?.selectedNumbers ?? [];
  const matched = outcome ? spotsMatch(spots, selected) : false;
  const receiptBet = matched
    ? copy.betName(spots)
    : selected.length === 1
      ? copy.spotName({ key: "number", n: selected[0]! }, "spot")
      : t("slip.numbers", { count: selected.length });
  const values = outcome?.rolls.map((roll) => roll.value) ?? [];
  const won = outcome?.rolls.filter((roll) => roll.won).length ?? 0;

  return {
    id: "roulette",
    line: t("slip.game", { bet: copy.betName(spots) ?? "–" }),
    covers: spots.length > 1 && k > 0 ? covers(covered) : undefined,
    chance: rouletteChance(k),
    payout: (perRound, bps) => roulettePayout(perRound, k, bps),
    selection,
    selectionNotice: selection
      ? { lead: t(`selection.${selection}.lead`), body: t(`selection.${selection}.body`) }
      : undefined,
    receipt: {
      line: t("slip.game", { bet: receiptBet ?? "–" }),
      covers: selected.length > 1 && (!matched || spots.length > 1) ? covers(selected) : undefined,
      rolled:
        values.length === 0
          ? null
          : {
              text: copy.rolledText(values, won),
              print: copy.rolledPrint(values, won, "paper")
            }
    }
  };
}
