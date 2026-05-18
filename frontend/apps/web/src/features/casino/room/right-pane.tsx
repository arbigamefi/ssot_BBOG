"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import {
  GameRoomHistoryWidget,
  type GameHistoryEntry,
  type RecentBetSummary
} from "./history-widget";
import type { CasinoOutcome } from "./outcome";
import type { BaccaratSide, CoinSide, DiceDirection, PlinkoRisk, SicBoKind } from "./params";
import { GameRoomResultOverlay } from "./result-overlay";
import { isCasinoTerminalRoundResult, type CasinoRoundResult } from "./resolution";

export type { GameHistoryEntry, RecentBetSummary } from "./history-widget";

function StageLoading() {
  const t = useTranslations();

  return (
    <div className="flex min-h-[280px] items-center justify-center text-sm font-bold uppercase tracking-[0.18em] text-fg-subtle">
      {t("casino.room.stage.loading")}
    </div>
  );
}

const DiceStage = dynamic(() => import("../modules/dice/stage").then((mod) => mod.DiceStage), {
  loading: StageLoading,
  ssr: false
});

const CoinTossStage = dynamic(
  () => import("../modules/coin-toss/stage").then((mod) => mod.CoinTossStage),
  {
    loading: StageLoading,
    ssr: false
  }
);

const RouletteStage = dynamic(
  () => import("../modules/roulette/stage").then((mod) => mod.RouletteStage),
  {
    loading: StageLoading,
    ssr: false
  }
);

const KenoStage = dynamic(() => import("../modules/keno/stage").then((mod) => mod.KenoStage), {
  loading: StageLoading,
  ssr: false
});

const PlinkoStage = dynamic(
  () => import("../modules/plinko/stage").then((mod) => mod.PlinkoStage),
  {
    loading: StageLoading,
    ssr: false
  }
);

const SlotsStage = dynamic(() => import("../modules/slots/stage").then((mod) => mod.SlotsStage), {
  loading: StageLoading,
  ssr: false
});

const BaccaratStage = dynamic(
  () => import("../modules/baccarat/stage").then((mod) => mod.BaccaratStage),
  {
    loading: StageLoading,
    ssr: false
  }
);

const SicBoStage = dynamic(() => import("../modules/sic-bo/stage").then((mod) => mod.SicBoStage), {
  loading: StageLoading,
  ssr: false
});

export function GameRoomRightPane({
  gameSlug,
  coinSide,
  flipCount,
  gameHistory,
  recentBets,
  isPending,
  showResult,
  resultNum,
  diceDirection,
  diceTarget,
  multiplier,
  winChance,
  rouletteSpots,
  kenoSpots,
  plinkoRisk,
  baccaratSide,
  sicBoKind,
  sicBoValue,
  plinkoBuckets,
  slotsSymbols,
  animatingKenoSpots,
  kenoResultDrawn,
  casinoOutcome,
  resultProof,
  chainId,
  assetSymbol,
  assetDecimals,
  onResultClose,
  onDiceDirectionChange,
  onDiceTargetChange,
  onRouletteChange,
  onKenoChange,
  onKenoResetResult
}: {
  gameSlug: string;
  coinSide: CoinSide;
  flipCount: number;
  gameHistory: readonly GameHistoryEntry[];
  recentBets: readonly RecentBetSummary[];
  isPending: boolean;
  showResult: boolean;
  resultNum: number | null;
  diceDirection: DiceDirection;
  diceTarget: number;
  multiplier: number;
  winChance: number;
  rouletteSpots: readonly string[];
  kenoSpots: readonly number[];
  plinkoRisk: PlinkoRisk;
  baccaratSide: BaccaratSide;
  sicBoKind: SicBoKind;
  sicBoValue: number;
  plinkoBuckets: readonly number[];
  slotsSymbols: readonly number[];
  animatingKenoSpots: readonly number[];
  kenoResultDrawn: readonly number[];
  casinoOutcome?: CasinoOutcome | null;
  resultProof: CasinoRoundResult | null;
  chainId?: number;
  assetSymbol?: string;
  assetDecimals?: number;
  onResultClose?: () => void;
  onDiceDirectionChange: (direction: DiceDirection) => void;
  onDiceTargetChange: (target: number) => void;
  onRouletteChange: (spots: string[]) => void;
  onKenoChange: (spots: number[]) => void;
  onKenoResetResult: () => void;
}) {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-8">
      <style
        dangerouslySetInnerHTML={{
          __html: `
         @keyframes dice-roll-3d { 0% { transform: rotateX(0deg) rotateY(0deg) scale(0.8); } 50% { transform: rotateX(540deg) rotateY(720deg) scale(1.2); } 100% { transform: rotateX(1080deg) rotateY(1440deg) scale(1); } }
         @keyframes toss-anim { 0% { transform: rotateX(20deg) rotateY(0deg) translateY(0px); } 50% { transform: rotateX(80deg) rotateY(900deg) translateY(-400px) scale(1.5); } 100% { transform: rotateX(20deg) rotateY(${flipCount * 1800 + (coinSide === "TAILS" ? 180 : 0)}deg) translateY(0px); } }
         @keyframes spin-coin-fast { 0% { transform: rotateX(10deg) rotateY(0deg) scale(1.2); } 100% { transform: rotateX(10deg) rotateY(360deg) scale(1.2); } }
       `
        }}
      />

      <GameRoomHistoryWidget
        gameSlug={gameSlug}
        gameHistory={gameHistory}
        recentBets={recentBets}
      />

      {gameSlug === "dice" && (
        <DiceStage
          isPending={isPending}
          showResult={showResult}
          resultNum={resultNum}
          diceDirection={diceDirection}
          diceTarget={diceTarget}
          multiplier={multiplier}
          winChance={winChance}
          onDirectionChange={onDiceDirectionChange}
          onTargetChange={onDiceTargetChange}
        />
      )}

      {gameSlug === "coin-toss" && (
        <CoinTossStage
          isPending={isPending}
          showResult={showResult}
          resultNum={resultNum}
          coinSide={coinSide}
        />
      )}

      {gameSlug === "roulette" && (
        <RouletteStage
          isPending={isPending}
          showResult={showResult}
          resultNum={resultNum}
          spots={rouletteSpots}
          onChange={onRouletteChange}
        />
      )}

      {gameSlug === "keno" && (
        <KenoStage
          isPending={isPending}
          showResult={showResult}
          spots={kenoSpots}
          animatingSpots={animatingKenoSpots}
          resultDrawn={kenoResultDrawn}
          onChange={onKenoChange}
          onResetResult={onKenoResetResult}
        />
      )}

      {gameSlug === "plinko" && (
        <PlinkoStage
          isPending={isPending}
          showResult={showResult}
          risk={plinkoRisk}
          buckets={plinkoBuckets}
        />
      )}

      {gameSlug === "slots" && (
        <SlotsStage isPending={isPending} showResult={showResult} symbols={slotsSymbols} />
      )}

      {gameSlug === "baccarat" && (
        <BaccaratStage
          isPending={isPending}
          showResult={showResult}
          selectedSide={baccaratSide}
          outcome={casinoOutcome?.kind === "baccarat" ? casinoOutcome : null}
        />
      )}

      {gameSlug === "sic-bo" && (
        <SicBoStage
          isPending={isPending}
          showResult={showResult}
          betKind={sicBoKind}
          betValue={sicBoValue}
          outcome={casinoOutcome?.kind === "sic-bo" ? casinoOutcome : null}
        />
      )}

      {showResult && resultProof && (isCasinoTerminalRoundResult(resultProof) || casinoOutcome) && (
        <GameRoomResultOverlay
          result={resultProof}
          chainId={chainId}
          assetSymbol={assetSymbol}
          assetDecimals={assetDecimals}
          gameSlug={gameSlug}
          resultNum={resultNum}
          diceDirection={diceDirection}
          diceTarget={diceTarget}
          coinSide={coinSide}
          rouletteSpots={rouletteSpots}
          kenoSpots={kenoSpots}
          kenoResultDrawn={kenoResultDrawn}
          casinoOutcome={casinoOutcome}
          onClose={onResultClose}
        />
      )}
    </div>
  );
}
