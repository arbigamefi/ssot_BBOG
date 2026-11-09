"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import { ProductStateCard } from "../../../../components/ProductStateCard";
import { PageTransition } from "../../../../components/PageTransition";

import { DiceRoom } from "../../../../features/casino/dice-room/dice-room";
import { GameClosedState } from "../../../../features/casino/room/game-closed";
import { useGameRoom } from "../../../../features/casino/room/use-game-room";
import { getLocalizedGameName } from "./pageClient-helpers";

// The games that have not moved to Carbon copy share the old room shell; it loads with them only.
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

  // The dice room is rebuilt in Carbon copy; the other games keep the shared shell until they move.
  if (game.slug === "dice")
    return (
      <PageTransition pageKey={`game-${slug}`}>
        <DiceRoom room={room} />
      </PageTransition>
    );

  return <SharedGameRoom slug={slug} room={room} />;
}
