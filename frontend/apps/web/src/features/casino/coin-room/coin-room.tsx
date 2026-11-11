"use client";

import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { getCasinoAccess } from "../../../app-shell/casino-access";
import { getAppChain } from "../../../app-shell/chain-registry";
import type { GameRoom } from "../room/use-game-room";
import { Printer, usePrinter } from "../table-room/printer";
import { RoomSlip } from "../table-room/room-slip";
import { RoomStrip } from "../table-room/room-strip";
import { FOCUS_ON_CARBON } from "../table-room/styles";
import { useCoinSlipGame } from "./coin-slip-game";
import { CoinTable } from "./coin-table";

/**
 * The coin toss room in Carbon copy, built like the other table rooms: the table is the game, the
 * paper is the proof. The felt takes the width, with the coin, its ring and the two spots for your
 * call on it; beside it the printer's slot, with the slip and the receipt hanging from it. On a
 * phone the slip is a sheet docked to the bottom.
 */
export function CoinRoom({ room }: { room: GameRoom }) {
  const t = useTranslations("casino.coin");
  const locale = useLocale();
  const { chainId, release } = room;
  const access = getCasinoAccess(chainId);
  const chainName = getAppChain(chainId)?.name ?? String(chainId);
  const houseEdgeBps = room.houseEdgeBps ?? release?.defaultHouseEdgeBps;
  const houseEdgeRate =
    houseEdgeBps == null
      ? "—"
      : new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(
          houseEdgeBps / 10_000
        );

  const outcome = room.casinoOutcome?.kind === "coin-toss" ? room.casinoOutcome : null;
  const shownOutcome = outcome && (room.stageReveal || room.showResult) ? outcome : null;
  const printer = usePrinter(room, shownOutcome);
  const slipGame = useCoinSlipGame(room);

  return (
    <div className="bg-carbon font-text text-body text-paper">
      <RoomStrip access={access} chainName={chainName} symbol={room.assetSymbol} />
      <div className="mx-auto box-content grid max-w-page grid-cols-[minmax(0,1fr)_minmax(360px,400px)] grid-rows-[auto_1fr] gap-x-[clamp(24px,3vw,48px)] px-gutter pt-4 pb-section max-[1080px]:grid-cols-1 max-[1080px]:gap-y-6 max-[720px]:gap-y-4 max-[720px]:pb-[220px]">
        <div className="col-start-1 row-start-1 pb-7 max-[1080px]:row-start-auto max-[1080px]:pb-0">
          <Link
            href="/casino"
            className={`text-note text-on-carbon-muted hover:text-paper ${FOCUS_ON_CARBON}`}
          >
            {t("head.crumb")}
          </Link>
          <h1 className="mt-2 text-heading font-extrabold">{t("head.title")}</h1>
          <p className="mt-3 max-w-[38em] text-body text-on-carbon-muted max-[720px]:text-note">
            {t("head.lede")}
          </p>
        </div>
        <div className="col-start-1 row-start-2 self-start max-[1080px]:row-start-auto">
          <CoinTable
            side={room.coinSide}
            onSideChange={room.setCoinSide}
            houseEdgeBps={houseEdgeBps}
            houseEdgeRate={houseEdgeRate}
            locked={room.isBetPanelPending || access === "preview"}
            phase={room.placeBetButtonPhase}
            outcome={shownOutcome}
            revealing={printer.revealing}
            decimals={room.assetDecimals}
            symbol={room.assetSymbol}
            onRolling={printer.onRolling}
            onLanded={printer.onLanded}
          />
        </div>
        <Printer
          state={printer.state}
          placedAt={room.casinoRound.activeBet?.placedAt}
          className="relative z-2 col-start-2 row-start-1 -mb-1.5 self-end max-[1080px]:col-start-1 max-[1080px]:row-start-auto max-[1080px]:mt-2 max-[1080px]:-mb-[30px] max-[1080px]:w-full max-[1080px]:max-w-[560px] max-[720px]:hidden"
        />
        <RoomSlip
          game={slipGame}
          room={room}
          access={access}
          chainName={chainName}
          houseEdgeRate={houseEdgeRate}
          holdReceipt={printer.rolling}
          className="col-start-2 row-start-2 self-start max-[1080px]:col-start-1 max-[1080px]:row-start-auto max-[1080px]:w-full max-[1080px]:max-w-[560px]"
        />
      </div>
    </div>
  );
}
