"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

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
  gameHistory,
  recentBets,
  isPending,
  controlsLocked = false,
  isRevealing,
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
  onDiceRevealComplete,
  onCoinRevealComplete,
  onRouletteRevealComplete,
  onDiceDirectionChange,
  onDiceTargetChange,
  onCoinSideChange,
  onRouletteChange,
  onKenoChange,
  onKenoResetResult,
  onKenoRevealComplete,
  onPlinkoRiskChange,
  onPlinkoRevealComplete,
  onSlotsRevealComplete,
  onSicBoRevealComplete,
  onBaccaratRevealComplete,
  onBaccaratSideChange,
  onSicBoChange
}: {
  gameSlug: string;
  coinSide: CoinSide;
  gameHistory: readonly GameHistoryEntry[];
  recentBets: readonly RecentBetSummary[];
  isPending: boolean;
  controlsLocked?: boolean;
  isRevealing?: boolean;
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
  onDiceRevealComplete?: () => void;
  onCoinRevealComplete?: () => void;
  onRouletteRevealComplete?: () => void;
  onDiceDirectionChange: (direction: DiceDirection) => void;
  onDiceTargetChange: (target: number) => void;
  onCoinSideChange: (side: CoinSide) => void;
  onRouletteChange: (spots: string[]) => void;
  onKenoChange: (spots: number[]) => void;
  onKenoResetResult: () => void;
  onKenoRevealComplete?: () => void;
  onPlinkoRiskChange: (risk: PlinkoRisk) => void;
  onPlinkoRevealComplete?: () => void;
  onSlotsRevealComplete?: () => void;
  onSicBoRevealComplete?: () => void;
  onBaccaratRevealComplete?: () => void;
  onBaccaratSideChange: (side: BaccaratSide) => void;
  onSicBoChange: (kind: SicBoKind, value: number) => void;
}) {
  const stageHeightClass =
    gameSlug === "sic-bo"
      ? "min-h-[38rem]"
      : gameSlug === "baccarat"
        ? "min-h-[34rem]"
        : gameSlug === "keno"
          ? "min-h-[38rem]"
          : gameSlug === "coin-toss"
            ? "min-h-[34rem]"
            : gameSlug === "roulette"
              ? "min-h-[38rem]"
              : gameSlug === "dice"
                ? "min-h-[34rem]"
                : gameSlug === "plinko"
                  ? "min-h-[38rem]"
                  : gameSlug === "slots"
                    ? "min-h-[34rem]"
                    : "min-h-[34rem] lg:min-h-0";

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col items-center justify-center p-8",
        stageHeightClass
      )}
    >
      <GameRoomHistoryWidget
        gameSlug={gameSlug}
        gameHistory={gameHistory}
        recentBets={recentBets}
      />

      {gameSlug === "dice" && (
        <DiceStage
          isPending={isPending}
          controlsLocked={controlsLocked}
          isRevealing={Boolean(isRevealing)}
          showResult={showResult}
          resultNum={resultNum}
          diceDirection={diceDirection}
          diceTarget={diceTarget}
          multiplier={multiplier}
          winChance={winChance}
          onDirectionChange={onDiceDirectionChange}
          onTargetChange={onDiceTargetChange}
          onRevealComplete={onDiceRevealComplete}
        />
      )}

      {gameSlug === "coin-toss" && (
        <CoinTossStage
          isPending={isPending}
          controlsLocked={controlsLocked}
          isRevealing={Boolean(isRevealing)}
          showResult={showResult}
          resultNum={resultNum}
          coinSide={coinSide}
          onSideChange={onCoinSideChange}
          onRevealComplete={onCoinRevealComplete}
        />
      )}

      {gameSlug === "roulette" && (
        <RouletteStage
          isPending={isPending}
          controlsLocked={controlsLocked}
          isRevealing={Boolean(isRevealing)}
          showResult={showResult}
          resultNum={resultNum}
          spots={rouletteSpots}
          onChange={onRouletteChange}
          onRevealComplete={onRouletteRevealComplete}
        />
      )}

      {gameSlug === "keno" && (
        <KenoStage
          isPending={isPending}
          controlsLocked={controlsLocked}
          isRevealing={Boolean(isRevealing)}
          showResult={showResult}
          spots={kenoSpots}
          animatingSpots={animatingKenoSpots}
          resultDrawn={kenoResultDrawn}
          onChange={onKenoChange}
          onResetResult={onKenoResetResult}
          onRevealComplete={onKenoRevealComplete}
        />
      )}

      {gameSlug === "plinko" && (
        <PlinkoStage
          isPending={isPending}
          controlsLocked={controlsLocked}
          isRevealing={Boolean(isRevealing)}
          showResult={showResult}
          risk={plinkoRisk}
          buckets={plinkoBuckets}
          onRiskChange={onPlinkoRiskChange}
          randomHash={resultProof?.randomHash}
          onRevealComplete={onPlinkoRevealComplete}
        />
      )}

      {gameSlug === "slots" && (
        <SlotsStage
          isPending={isPending}
          controlsLocked={controlsLocked}
          isRevealing={Boolean(isRevealing)}
          showResult={showResult}
          symbols={slotsSymbols}
          onRevealComplete={onSlotsRevealComplete}
        />
      )}

      {gameSlug === "baccarat" && (
        <BaccaratStage
          isPending={isPending}
          controlsLocked={controlsLocked}
          isRevealing={Boolean(isRevealing)}
          showResult={showResult}
          selectedSide={baccaratSide}
          onSideChange={onBaccaratSideChange}
          outcome={casinoOutcome?.kind === "baccarat" ? casinoOutcome : null}
          onRevealComplete={onBaccaratRevealComplete}
        />
      )}

      {gameSlug === "sic-bo" && (
        <SicBoStage
          isPending={isPending}
          controlsLocked={controlsLocked}
          isRevealing={Boolean(isRevealing)}
          showResult={showResult}
          betKind={sicBoKind}
          betValue={sicBoValue}
          onBetChange={onSicBoChange}
          outcome={casinoOutcome?.kind === "sic-bo" ? casinoOutcome : null}
          onRevealComplete={onSicBoRevealComplete}
        />
      )}

      {showResult && resultProof && isCasinoTerminalRoundResult(resultProof) && (
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
