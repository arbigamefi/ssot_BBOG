"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import { ProductStateCard } from "../../../../components/ProductStateCard";
import { PageTransition } from "../../../../components/PageTransition";

import { GameClosedState } from "../../../../features/casino/room/game-closed";
import { useGameRoom } from "../../../../features/casino/room/use-game-room";
import { getLocalizedGameName } from "./pageClient-helpers";

// Each room loads with its own game only, so one game's table never weighs on another's page. The
// games that have not moved to Carbon copy share the old room shell.
const DiceRoom = dynamic(() =>
  import("../../../../features/casino/dice-room/dice-room").then((mod) => mod.DiceRoom)
);
const RouletteRoom = dynamic(() =>
  import("../../../../features/casino/roulette-room/roulette-room").then((mod) => mod.RouletteRoom)
);
const SharedGameRoom = dynamic(() =>
  import("./shared-game-room").then((mod) => mod.SharedGameRoom)
);

export { getCasinoRoomPendingStates } from "../../../../features/casino/room/use-game-room";

export function GamePageClient({ slug }: { slug: string }) {
  const t = useTranslations();
  const room = useGameRoom(slug);
  const { game, release, casinoPoolAsset, readOnlyReason } = room;

  if (!release || !game || !casinoPoolAsset)
    return (
      <ProductStateCard
        title={t("casino.room.empty.moduleNotFound")}
        description={readOnlyReason ?? t("casino.room.empty.gameNotFound")}
      />
    );
  // No bet panel for a disabled game: it takes no new bets, but accepted ones still settle.
  if (room.casinoRound.gameDisabled)
    return (
      <PageTransition pageKey={`game-${slug}-closed`}>
        <GameClosedState gameName={getLocalizedGameName(t, game)} />
      </PageTransition>
    );

  // Dice and roulette are rebuilt in Carbon copy; the other games keep the shared shell until they move.
  if (game.slug === "dice" || game.slug === "roulette")
    return (
      <PageTransition pageKey={`game-${slug}`}>
        {game.slug === "dice" ? <DiceRoom room={room} /> : <RouletteRoom room={room} />}
      </PageTransition>
    );

  return <SharedGameRoom slug={slug} room={room} />;
}
