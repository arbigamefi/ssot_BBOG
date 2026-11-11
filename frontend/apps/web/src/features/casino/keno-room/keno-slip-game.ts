"use client";

import type { GameRoom } from "../room/use-game-room";
import type { SlipGame } from "../table-room/room-slip";
import { useKenoCopy, type Draw } from "./keno-copy";
import { kenoChance, kenoPayout, paysMore } from "./keno-model";

/** The keno bet as the slip and the receipt print it: the numbers picked and what all hit pays. */
export function useKenoSlipGame(room: GameRoom): SlipGame {
  const copy = useKenoCopy();
  const { t } = copy;
  const picks = room.kenoSpots;
  const picked = picks.length;
  const bps = room.houseEdgeBps ?? room.release?.defaultHouseEdgeBps ?? 0;
  const outcome = room.casinoOutcome?.kind === "keno" ? room.casinoOutcome : null;
  const settled = outcome?.pickedNumbers ?? [];
  const draws: Draw[] =
    outcome?.draws.map((draw) => ({
      numbers: draw.numbers,
      hits: draw.hits,
      paid: paysMore(settled.length, draw.hits, bps)
    })) ?? [];
  const line = (numbers: readonly number[]) =>
    numbers.length === 0 ? t("slip.none") : t("slip.game", { numbers: copy.list(numbers) });
  const allHit = (perRound: bigint, houseEdgeBps: number) =>
    kenoPayout(perRound, picked, picked, houseEdgeBps);

  return {
    id: "keno",
    line: line(picks),
    chance: picked === 0 ? "0" : kenoChance(picked, bps),
    payout: allHit,
    lines:
      picked === 0 ? undefined : [{ label: t("slip.allHit", { count: picked }), payout: allHit }],
    selection: picked === 0 ? "empty" : undefined,
    selectionNotice:
      picked === 0
        ? { lead: t("selection.empty.lead"), body: t("selection.empty.body") }
        : undefined,
    receipt: {
      line: line(settled),
      rolled:
        draws.length === 0
          ? null
          : {
              text: copy.drewText(draws, settled.length),
              print: copy.drewPrint(draws, settled, "paper")
            }
    }
  };
}
