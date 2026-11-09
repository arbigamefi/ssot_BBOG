"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { getCasinoAccess } from "../../../app-shell/casino-access";
import { getAppChain, getExplorerAddressUrl } from "../../../app-shell/chain-registry";
import { casinoVrfFeeBudget, formatNativeFee, toUnixMs } from "../room/casino-round";
import { isCasinoTerminalRoundResult } from "../room/resolution";
import type { GameRoom } from "../room/use-game-room";
import { DiceSlip, useNow } from "./dice-slip";
import { DiceTable } from "./dice-table";
import { diceMultiplier, formatQuote, quoteRaw } from "./slip-model";
import { FOCUS_ON_CARBON } from "./styles";
import { printerState, type PrinterState } from "./table-model";

// The receipts and the rules sit below the room, so they load after it.
const DiceReceipts = dynamic(() => import("./dice-sections").then((mod) => mod.DiceReceipts));
const DiceRules = dynamic(() => import("./dice-sections").then((mod) => mod.DiceRules));

/** How long the receipt takes to print out of the slot (12-motion.md §3). */
const PRINT_MS = 1_500;

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
  const revealing = room.stageReveal?.phase === "revealing";
  const { completeStageReveal } = room;
  // The receipt prints once the ball has stopped, even when the bet settled while it rolled.
  const [rolling, setRolling] = React.useState(false);
  const onRolling = React.useCallback(() => setRolling(true), []);
  const onLanded = React.useCallback(() => {
    setRolling(false);
    if (revealing) completeStageReveal();
  }, [completeStageReveal, revealing]);
  const shownOutcome = outcome && (room.stageReveal || room.showResult) ? outcome : null;
  React.useEffect(() => {
    if (!shownOutcome) setRolling(false);
  }, [shownOutcome]);

  const receipt = room.showResult && isCasinoTerminalRoundResult(room.resultProof) && !rolling;
  const [printed, setPrinted] = React.useState(false);
  React.useEffect(() => {
    setPrinted(false);
    if (!receipt) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true;
    const timer = setTimeout(() => setPrinted(true), still ? 0 : PRINT_MS);
    return () => clearTimeout(timer);
  }, [receipt]);
  const printer = printerState({
    phase: room.placeBetButtonPhase,
    revealing: rolling || revealing,
    receipt,
    printed
  });

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
            revealing={revealing}
            decimals={room.assetDecimals}
            symbol={room.assetSymbol}
            onDirectionChange={room.changeDiceDirection}
            onLineChange={room.changeDiceTarget}
            onRolling={onRolling}
            onLanded={onLanded}
          />
        </div>
        <Printer
          state={printer}
          placedAt={room.casinoRound.activeBet?.placedAt}
          className="relative z-2 col-start-2 row-start-1 -mb-1.5 self-end max-[1080px]:col-start-1 max-[1080px]:row-start-auto max-[1080px]:mt-2 max-[1080px]:-mb-[30px] max-[1080px]:w-full max-[1080px]:max-w-[560px] max-[720px]:hidden"
        />
        <DiceSlip
          room={room}
          access={access}
          chainName={chainName}
          houseEdgeRate={houseEdgeRate}
          holdReceipt={rolling}
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

/**
 * The printer is only its paper slot, level with the top of the felt, with one status light above
 * it. The slip's own live region says the same to a screen reader.
 */
function Printer({
  state,
  placedAt,
  className
}: {
  state: PrinterState;
  placedAt: number | undefined;
  className: string;
}) {
  const t = useTranslations("casino.dice.printer");
  const now = useNow(state === "waiting");
  const placedMs = toUnixMs(placedAt);
  const seconds = placedMs ? Math.max(0, Math.floor((now - placedMs) / 1000)) : 0;
  const lit = state != null && state !== "ready";
  return (
    <div aria-hidden="true" className={className}>
      <span className="mx-1 mb-2.5 flex min-h-[1.45em] items-center justify-end gap-2 text-note text-on-carbon-muted tabular-nums">
        <i
          data-lit={lit || undefined}
          className={`table-led size-[7px] ${
            state === "waiting"
              ? "motion-safe:animate-led-wait"
              : state === "printing"
                ? "motion-safe:animate-led-print"
                : ""
          }`}
        />
        <span>{state == null ? "" : t(state, { seconds })}</span>
      </span>
      <div className="print-slot mx-0.5 h-3" />
    </div>
  );
}
