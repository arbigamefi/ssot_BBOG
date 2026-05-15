import * as React from "react";

import { CoinTossStage } from "./coin-toss-stage";
import { DiceStage } from "./dice-stage";
import {
  GameRoomHistoryWidget,
  type GameHistoryEntry,
  type RecentBetSummary
} from "./history-widget";
import { KenoStage } from "./keno-stage";
import type { CoinSide, DiceDirection } from "./params";
import { GameRoomResultOverlay } from "./result-overlay";
import { RouletteStage } from "./roulette-stage";

export type { GameHistoryEntry, RecentBetSummary } from "./history-widget";

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
  animatingKenoSpots,
  kenoResultDrawn,
  expectedPayout,
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
  animatingKenoSpots: readonly number[];
  kenoResultDrawn: readonly number[];
  expectedPayout: number;
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

      {showResult && (
        <GameRoomResultOverlay
          gameSlug={gameSlug}
          coinSide={coinSide}
          resultNum={resultNum}
          expectedPayout={expectedPayout}
        />
      )}
    </div>
  );
}
