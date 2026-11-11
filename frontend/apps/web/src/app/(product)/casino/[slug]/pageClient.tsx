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
const SlotsRoom = dynamic(() =>
  import("../../../../features/casino/slots-room/slots-room").then((mod) => mod.SlotsRoom)
);
const KenoRoom = dynamic(() =>
  import("../../../../features/casino/keno-room/keno-room").then((mod) => mod.KenoRoom)
);
const PlinkoRoom = dynamic(() =>
  import("../../../../features/casino/plinko-room/plinko-room").then((mod) => mod.PlinkoRoom)
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

  // Dice, roulette, slots, keno and plinko are rebuilt in Carbon copy; the other games keep the
  // shared shell until they move.
  const CarbonRoom =
    game.slug === "dice"
      ? DiceRoom
      : game.slug === "roulette"
        ? RouletteRoom
        : game.slug === "slots"
          ? SlotsRoom
          : game.slug === "keno"
            ? KenoRoom
            : game.slug === "plinko"
              ? PlinkoRoom
              : null;
  if (CarbonRoom)
    return (
      <PageTransition pageKey={`game-${slug}`}>
        <CarbonRoom room={room} />
      </PageTransition>
    );

  return <SharedGameRoom slug={slug} room={room} />;
}
