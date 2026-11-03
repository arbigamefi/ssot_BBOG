"use client";

import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { getCasinoAccess } from "../../../app-shell/casino-access";
import { getAppChain, getExplorerAddressUrl } from "../../../app-shell/chain-registry";
import { casinoVrfFeeBudget, formatNativeFee } from "../room/casino-round";
import type { GameRoom } from "../room/use-game-room";
import { DiceSlip } from "./dice-slip";
import { DiceReceipts, DiceRules, SECTION_GRID } from "./dice-sections";
import { DiceTable, type DiceRoll } from "./dice-table";
import { diceMultiplier, formatQuote, quoteRaw } from "./slip-model";
import { FOCUS_ON_CARBON } from "./styles";

/**
 * The dice room in Carbon copy: the table on the left, the slip on the right, then the latest dice
 * receipts and the rules. The slip is the quote and prints the receipt; nothing opens over the room.
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
  const rolls = React.useMemo<DiceRoll[] | undefined>(
    () =>
      outcome && (room.stageReveal || room.showResult)
        ? outcome.rolls.map((roll) => ({ value: roll.value, won: roll.won }))
        : undefined,
    [outcome, room.showResult, room.stageReveal]
  );
  const revealing = room.stageReveal?.phase === "revealing";
  const { completeStageReveal } = room;
  const onPunched = React.useCallback(() => {
    if (revealing) completeStageReveal();
  }, [completeStageReveal, revealing]);

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
      {access === "live" ? null : (
        <p className="border-b border-rule-carbon bg-carbon-deep py-2 text-note text-on-carbon-muted">
          <span className="mx-auto box-content block max-w-page px-gutter">
            {access === "preview"
              ? t("strip.preview")
              : t("strip.testnet", { chain: chainName, symbol: room.assetSymbol })}
          </span>
        </p>
      )}
      <div className={`${SECTION_GRID} gap-y-6 pt-4 pb-section lg:grid-rows-[auto_1fr] lg:gap-y-0`}>
        <div className="lg:col-span-7 lg:row-start-1 lg:pb-8">
          <Link
            href="/casino"
            className={`text-note text-on-carbon-muted hover:text-paper ${FOCUS_ON_CARBON}`}
          >
            {t("head.crumb")}
          </Link>
          <h1 className="mt-2 text-heading font-extrabold">{t("head.title")}</h1>
          <p className="mt-2 max-w-[34em] text-lede text-on-carbon-muted md:mt-4">
            {t("head.lede")}
          </p>
        </div>
        <div className="self-start lg:col-span-7 lg:row-start-2">
          <DiceTable
            direction={room.diceDirection}
            line={room.diceTarget}
            houseEdgeBps={houseEdgeBps}
            locked={room.isBetPanelPending || access === "preview"}
            rolls={rolls}
            onDirectionChange={room.changeDiceDirection}
            onLineChange={room.changeDiceTarget}
            onPunched={onPunched}
          />
        </div>
        <div className="w-full lg:col-span-5 lg:col-start-8 lg:row-span-full lg:max-w-[440px] lg:justify-self-end">
          <DiceSlip
            room={room}
            access={access}
            chainName={chainName}
            houseEdgeRate={houseEdgeRate}
          />
        </div>
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
