"use client";

import type { GameRoom } from "../room/use-game-room";
import type { SlipGame } from "../table-room/room-slip";
import { useSlotsCopy, type Spin } from "./slots-copy";
import { PAY_LINES, slotsChance, slotsPayout } from "./slots-model";

/** The slots bet as the slip and the receipt print it: what each line pays for the stake. */
export function useSlotsSlipGame(room: GameRoom): SlipGame {
  const copy = useSlotsCopy();
  const { t } = copy;
  const outcome = room.casinoOutcome?.kind === "slots" ? room.casinoOutcome : null;
  const spins: Spin[] =
    outcome?.rolls.map((roll) => ({ symbols: roll.symbols, paid: roll.won })) ?? [];
  const line = t("slip.game");

  return {
    id: "slots",
    line,
    chance: slotsChance(),
    payout: (perRound, bps) => slotsPayout(perRound, 64, bps),
    lines: PAY_LINES.map(({ key, multiple }) => ({
      label: t(`slip.pays.${key}`),
      payout: (perRound: bigint, bps: number) => slotsPayout(perRound, multiple, bps)
    })),
    receipt: {
      line,
      rolled:
        spins.length === 0
          ? null
          : { text: copy.rolledText(spins), print: copy.rolledPrint(spins, "paper") }
    }
  };
}
