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
import type { BaccaratSide, CoinSide, SicBoKind } from "./params";
import { isCasinoTerminalRoundResult, type CasinoRoundResult } from "./resolution";

export type { GameHistoryEntry, RecentBetSummary } from "./history-widget";

const GameRoomResultOverlay = dynamic(
  () => import("./result-overlay").then((mod) => mod.GameRoomResultOverlay),
  { ssr: false }
);

function StageLoading() {
  const t = useTranslations();

  return (
    <div className="flex min-h-[280px] items-center justify-center text-sm font-bold uppercase tracking-[0.18em] text-fg-subtle">
      {t("casino.room.stage.loading")}
    </div>
  );
}

const CoinTossStage = dynamic(
  () => import("../modules/coin-toss/stage").then((mod) => mod.CoinTossStage),
  {
    loading: StageLoading,
    ssr: false
  }
);

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
  houseEdgeBps,
  baccaratSide,
  sicBoKind,
  sicBoValue,
  casinoOutcome,
  resultProof,
  chainId,
  assetSymbol,
  assetDecimals,
  onResultClose,
  onResultPlayAgain,
  onCoinRevealComplete,
  onCoinSideChange,
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
  houseEdgeBps: number;
  baccaratSide: BaccaratSide;
  sicBoKind: SicBoKind;
  sicBoValue: number;
  casinoOutcome?: CasinoOutcome | null;
  resultProof: CasinoRoundResult | null;
  chainId?: number;
  assetSymbol?: string;
  assetDecimals?: number;
  onResultClose?: () => void;
  onResultPlayAgain?: () => void;
  onCoinRevealComplete?: () => void;
  onCoinSideChange: (side: CoinSide) => void;
  onSicBoRevealComplete?: () => void;
  onBaccaratRevealComplete?: () => void;
  onBaccaratSideChange: (side: BaccaratSide) => void;
  onSicBoChange: (kind: SicBoKind, value: number) => void;
}) {
  const stageHeightClass =
    gameSlug === "sic-bo"
      ? "lg:min-h-[38rem]"
      : gameSlug === "baccarat"
        ? "lg:min-h-[34rem]"
        : "lg:min-h-[34rem]";
  return (
    <div
      className={cn(
        "relative flex w-full flex-col items-stretch justify-center p-0 lg:h-full lg:items-center lg:p-8",
        stageHeightClass
      )}
    >
      <GameRoomHistoryWidget
        gameSlug={gameSlug}
        gameHistory={gameHistory}
        recentBets={recentBets}
      />

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

      {gameSlug === "baccarat" && (
        <BaccaratStage
          isPending={isPending}
          controlsLocked={controlsLocked}
          isRevealing={Boolean(isRevealing)}
          showResult={showResult}
          selectedSide={baccaratSide}
          houseEdgeBps={houseEdgeBps}
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
          houseEdgeBps={houseEdgeBps}
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
          houseEdgeBps={houseEdgeBps}
          resultNum={resultNum}
          coinSide={coinSide}
          casinoOutcome={casinoOutcome}
          onClose={onResultClose}
          onPlayAgain={onResultPlayAgain}
        />
      )}
    </div>
  );
}
