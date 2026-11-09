"use client";

import { useLocale, useTranslations } from "next-intl";

import type { GameRoom } from "../room/use-game-room";
import { formatRolls } from "../table-room/room-receipt";
import type { SlipGame } from "../table-room/room-slip";
import { dicePayout, diceWinRange, diceWins } from "./dice-model";

/** The dice bet as the slip and the receipt print it. */
export function useDiceSlipGame(room: GameRoom): SlipGame {
  const t = useTranslations("casino.dice");
  const locale = useLocale();
  const outcome = room.casinoOutcome?.kind === "dice" ? room.casinoOutcome : null;
  const wins = diceWins(room.diceDirection, room.diceTarget);
  const [from, to] = diceWinRange(room.diceDirection, room.diceTarget);
  const [rFrom, rTo] = diceWinRange(
    outcome?.direction ?? room.diceDirection,
    outcome?.target ?? room.diceTarget
  );
  const rolls = outcome?.rolls ?? [];
  const won = rolls.filter((roll) => roll.won).length;
  const rolled =
    rolls.length === 0
      ? null
      : rolls.length > 1
        ? t("receipt.rolledRounds", {
            rolls: formatRolls(
              locale,
              rolls.map((roll) => roll.value)
            ),
            won,
            count: rolls.length
          })
        : t("receipt.rolled", { rolls: String(rolls[0]!.value) });
  return {
    id: "dice",
    line: t("slip.game", { from, to }),
    chance: String(wins),
    payout: (perRound, bps) => dicePayout(perRound, wins, bps),
    receipt: {
      line: t("slip.game", { from: rFrom, to: rTo }),
      rolled: rolled ? { text: rolled } : null
    }
  };
}
