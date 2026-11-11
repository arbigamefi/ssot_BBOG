"use client";

import type { GameRoom } from "../room/use-game-room";
import type { SlipGame } from "../table-room/room-slip";
import { useSicBoCopy, type Roll } from "./sicbo-copy";
import { areaChance, headlineFactor, payoutFor, type Area } from "./sicbo-model";

/**
 * The sic bo bet as the slip and the receipt print it: the area, and what a win on it pays. A
 * single face pays for every die that shows it, so the slip lists one, two and three dice.
 */
export function useSicBoSlipGame(room: GameRoom): SlipGame {
  const copy = useSicBoCopy();
  const { t } = copy;
  const area: Area = { kind: room.sicBoKind, value: room.sicBoValue };
  const outcome = room.casinoOutcome?.kind === "sic-bo" ? room.casinoOutcome : null;
  const rolls: Roll[] = outcome?.rolls.map((roll) => ({ dice: roll.dice, won: roll.won })) ?? [];
  const bet: Area = outcome ? { kind: outcome.betKind, value: outcome.betValue } : area;
  const factor = headlineFactor(area);
  const payout = (perRound: bigint, houseEdgeBps: number) =>
    payoutFor(perRound, factor, houseEdgeBps);

  return {
    id: "sicbo",
    line: t("slip.game", { area: copy.area(area) }),
    chance: areaChance(area),
    payout,
    lines:
      area.kind === "singleFace"
        ? ([1, 2, 3] as const).map((count) => ({
            label: t("slip.dice", { count }),
            payout: (perRound: bigint, houseEdgeBps: number) =>
              payoutFor(perRound, factor * count, houseEdgeBps)
          }))
        : undefined,
    receipt: {
      line: t("slip.game", { area: copy.area(bet) }),
      rolled:
        outcome && rolls.length > 0
          ? { text: copy.rolledText(rolls, bet), print: copy.rolledPrint(rolls, bet) }
          : null
    }
  };
}
