import * as React from "react";
import { cn } from "@ssot/ui";

import { RED_NUMBER_SET } from "./model";
import type { CoinSide, DiceDirection } from "./params";
import { RouletteStage } from "./roulette-stage";
import { CoinTossStage, DiceStage, KenoStage } from "./stages";

export type GameHistoryEntry = {
  val: number;
  win: boolean;
};

export type RecentBetSummary = {
  id: string;
  betId: string | number | bigint;
  state: string;
};

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

      <div className="absolute top-6 right-6 lg:top-8 lg:right-8 z-20 hidden md:block">
        <div className="flex flex-col items-end gap-2 p-3 rounded-2xl border border-white/5 bg-[#050505]/90 backdrop-blur-xl shadow-2xl min-w-[200px] max-w-[260px]">
          <div className="text-[10px] font-bold text-white/30 tracking-widest uppercase px-1 w-full">
            {gameSlug === "dice"
              ? "RECENT ROLLS"
              : gameSlug === "roulette"
                ? "RECENT NUMBERS"
                : gameSlug === "keno"
                  ? "RECENT DRAWS"
                  : "RECENT FLIPS"}
          </div>
          {gameHistory.length > 0 && (
            <div className="flex gap-1.5 justify-end flex-wrap w-full">
              {gameHistory.map((res, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold font-mono border",
                    res.win
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                      : "bg-red-500/10 text-red-400 border-red-500/20"
                  )}
                >
                  {gameSlug === "coin-toss" ? (
                    res.val === 1 ? (
                      "H"
                    ) : (
                      "T"
                    )
                  ) : gameSlug === "keno" ? (
                    res.val
                  ) : gameSlug === "roulette" ? (
                    <span
                      className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[8px]",
                        res.val === 0
                          ? "bg-emerald-500"
                          : RED_NUMBER_SET.has(res.val)
                            ? "bg-red-600"
                            : "bg-zinc-700"
                      )}
                    >
                      {res.val}
                    </span>
                  ) : (
                    res.val
                  )}
                </div>
              ))}
            </div>
          )}
          {recentBets.length > 0 && (
            <div className="w-full border-t border-white/5 pt-2 mt-1 flex flex-col gap-1">
              {recentBets.slice(0, 3).map((bet) => (
                <div key={bet.id} className="flex justify-between items-center">
                  <span className="text-[9px] font-mono text-white/30">
                    #{bet.betId.toString().slice(-6)}
                  </span>
                  <span
                    className={cn(
                      "text-[9px] font-bold px-2 py-0.5 rounded-full border",
                      bet.state === "finalized"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : bet.state === "refunded"
                          ? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                          : bet.state === "randomReady"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    )}
                  >
                    {bet.state === "finalized"
                      ? "SETTLED"
                      : bet.state === "refunded"
                        ? "REFUNDED"
                        : bet.state === "randomReady"
                          ? "VRF READY"
                          : "PLACED"}
                  </span>
                </div>
              ))}
            </div>
          )}
          {gameHistory.length === 0 && recentBets.length === 0 && (
            <span className="text-[10px] text-white/10 px-2 py-1">Waiting for first play...</span>
          )}
        </div>
      </div>

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
        <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in zoom-in pointer-events-auto">
          <div className="p-12 rounded-[4rem] border border-white/10 bg-[#050505] shadow-[0_0_100px_rgba(0,0,0,1)] flex flex-col items-center text-center max-w-sm w-full relative overflow-hidden transition-all scale-110">
            <div className="absolute inset-0 blur-[100px] opacity-20 bg-emerald-500 animate-pulse" />
            <h3 className="text-xl font-bold text-white/40 uppercase tracking-[0.3em] mb-6">
              Verification Success
            </h3>
            <div
              className={cn(
                "text-7xl font-mono font-black mb-8 w-64 h-36 rounded-[2.5rem] flex items-center justify-center border-4 bg-emerald-500/10 border-emerald-400 text-emerald-300 shadow-[0_0_50px_rgba(52,211,153,0.3)]"
              )}
            >
              {gameSlug === "coin-toss"
                ? coinSide === "TAILS"
                  ? "TAILS"
                  : "HEADS"
                : (resultNum ?? 42)}
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-emerald-400 font-black text-lg tracking-widest mb-2 flex items-center gap-2">
                DIRECT PREDICTION HIT{" "}
                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_emerald]" />
              </span>
              <span className="text-5xl font-mono text-white font-black">
                +{expectedPayout.toFixed(2)} <span className="text-xl opacity-30">USDC</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
