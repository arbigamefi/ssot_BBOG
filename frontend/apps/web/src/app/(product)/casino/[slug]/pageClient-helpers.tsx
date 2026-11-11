"use client";

import type { GameMeta } from "../../../../features/casino/room/model";

export function getLocalizedGameName(t: (key: string) => string, game: GameMeta) {
  switch (game.slug) {
    case "dice":
      return t("casino.room.names.dice");
    case "roulette":
      return t("casino.room.names.roulette");
    case "coin-toss":
      return t("casino.room.names.coinToss");
    case "keno":
      return t("casino.room.names.keno");
    case "plinko":
      return t("casino.room.names.plinko");
    case "slots":
      return t("casino.room.names.slots");
    case "baccarat":
      return t("casino.room.names.baccarat");
    case "sic-bo":
      return t("casino.room.names.sicBo");
    default:
      return game.label;
  }
}
