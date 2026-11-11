"use client";

import type { GameRoom } from "../room/use-game-room";
import type { SlipGame } from "../table-room/room-slip";
import { usePlinkoCopy, type Drop } from "./plinko-copy";
import { cupMultiplier, pathBits, paysMore, plinkoChance, plinkoPayout } from "./plinko-model";

const text = ({ whole, fraction }: { whole: string; fraction: string }) =>
  fraction ? `${whole}.${fraction}` : whole;

/** The plinko bet as the slip and the receipt print it: the risk, and what an outer cup pays. */
export function usePlinkoSlipGame(room: GameRoom): SlipGame {
  const copy = usePlinkoCopy();
  const { t } = copy;
  const bps = room.houseEdgeBps ?? room.release?.defaultHouseEdgeBps ?? 0;
  const risk = room.plinkoRisk;
  const outcome = room.casinoOutcome?.kind === "plinko" ? room.casinoOutcome : null;
  const drops: Drop[] =
    outcome?.rolls.map((roll) => ({
      bits: pathBits(roll.path),
      cup: roll.bucket,
      multiple: text(cupMultiplier(outcome.risk, roll.bucket, bps)),
      paid: paysMore(outcome.risk, roll.bucket, bps)
    })) ?? [];
  const outer = (perRound: bigint, houseEdgeBps: number) =>
    plinkoPayout(perRound, risk, 0, houseEdgeBps);

  return {
    id: "plinko",
    line: t("slip.game", { risk }),
    chance: plinkoChance(risk, bps),
    payout: outer,
    lines: [{ label: t("slip.outer"), payout: outer }],
    receipt: {
      line: t("slip.game", { risk: outcome?.risk ?? risk }),
      rolled:
        drops.length === 0 ? null : { text: copy.fellText(drops), print: copy.fellPrint(drops) }
    }
  };
}
