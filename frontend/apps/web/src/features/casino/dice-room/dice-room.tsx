"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { getCasinoAccess } from "../../../app-shell/casino-access";
import { getAppChain, getExplorerAddressUrl } from "../../../app-shell/chain-registry";
import { casinoVrfFeeBudget, formatNativeFee } from "../room/casino-round";
import type { GameRoom } from "../room/use-game-room";
import { Printer, usePrinter } from "../table-room/printer";
import { RoomSlip } from "../table-room/room-slip";
import { RoomStrip } from "../table-room/room-strip";
import { formatQuote, quoteRaw } from "../table-room/slip-model";
import { FOCUS_ON_CARBON } from "../table-room/styles";
import { diceMultiplier } from "./dice-model";
import { useDiceSlipGame } from "./dice-slip-game";
import { DiceTable } from "./dice-table";

// The receipts and the rules sit below the room, so they load after it.
const DiceReceipts = dynamic(() => import("./dice-sections").then((mod) => mod.DiceReceipts));
const DiceRules = dynamic(() => import("./dice-sections").then((mod) => mod.DiceRules));

/**
 * The dice room in Carbon copy, in two layers: the table is the game, the paper is the proof. The
 * felt takes the width; beside it the printer's slot, with the slip and the receipt hanging from
 * it. On a phone the slip is a sheet docked to the bottom. Then the latest receipts and the rules.
 */
export function DiceRoom({ room }: { room: GameRoom }) {
  const t = useTranslations("casino.dice");
  const locale = useLocale();
  const { chainId, release, game, casinoRound } = room;
  const access = getCasinoAccess(chainId);
  const chainName = getAppChain(chainId)?.name ?? String(chainId);
  const houseEdgeBps = room.houseEdgeBps ?? release?.defaultHouseEdgeBps;
  const houseEdgeRate =
    houseEdgeBps == null
      ? "—"
      : new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(
          houseEdgeBps / 10_000
        );

  const outcome = room.casinoOutcome?.kind === "dice" ? room.casinoOutcome : null;
  const shownOutcome = outcome && (room.stageReveal || room.showResult) ? outcome : null;
  const printer = usePrinter(room, shownOutcome);
  const slipGame = useDiceSlipGame(room);

  const refundSeconds = release?.refundTimeoutSeconds;
  const fee = casinoVrfFeeBudget(casinoRound.vrfQuote);
  const figures = {
    houseEdgeRate,
    paysAtHalf:
      houseEdgeBps == null
        ? "—"
        : (({ whole, fraction }) => `${whole}.${fraction}`)(diceMultiplier(50, houseEdgeBps)),
    minStake: room.poolSnapshot
      ? formatQuote(
          quoteRaw(room.poolSnapshot.minBetAmount, room.assetDecimals, "up"),
          room.assetDecimals
        )
      : "—",
    maxRounds: casinoRound.maxBetCount ? String(casinoRound.maxBetCount) : "—",
    feeBudget: fee == null ? "—" : formatNativeFee(fee, "ETH", "up"),
    refundWait: refundSeconds
      ? refundSeconds % 3600 === 0
        ? t("rules.hours", { count: refundSeconds / 3600 })
        : t("rules.minutes", { count: Math.ceil(refundSeconds / 60) })
      : "—",
    contractHref: (game && getExplorerAddressUrl(chainId, game.module)) || undefined
  };

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
          <DiceTable
            direction={room.diceDirection}
            line={room.diceTarget}
            houseEdgeBps={houseEdgeBps}
            houseEdgeRate={houseEdgeRate}
            locked={room.isBetPanelPending || access === "preview"}
            phase={room.placeBetButtonPhase}
            outcome={shownOutcome}
            revealing={printer.revealing}
            decimals={room.assetDecimals}
            symbol={room.assetSymbol}
            onDirectionChange={room.changeDiceDirection}
            onLineChange={room.changeDiceTarget}
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
      <DiceReceipts
        room={room}
        rows={room.recentBets}
        status={room.recentBetsStatus}
        testnet={access === "testnet"}
        chainName={chainName}
      />
      <DiceRules figures={figures} symbol={room.assetSymbol} />
    </div>
  );
}
