import * as React from "react";
import {
  ChartBarIcon,
  ChevronDownIcon,
  CurrencyDollarIcon,
  InformationCircleIcon,
  WalletIcon
} from "@heroicons/react/24/outline";
import { cn } from "@ssot/ui";

import { CoinSideSelector, KenoSelectionPanel, RouletteSelectionPanel } from "./controls";
import type { GameMeta } from "./model";
import type { CoinSide } from "./params";

export type GameBetPanelState = {
  status: string;
  error?: { message?: string };
  plan?: { preview?: { needsApproval?: boolean } };
};

export function getPlaceBetButtonLabel({
  hasAccount,
  state,
  isPending
}: {
  hasAccount: boolean;
  state: GameBetPanelState;
  isPending: boolean;
}) {
  if (!hasAccount) return "CONNECT WALLET";
  if (state.status === "failed") return "TRANSACTION FAILED - RETRY";
  if (isPending || state.status === "reconciled") return "WAITING FOR VRF...";
  if (state.status === "mined" || state.status === "submitting") return "CONFIRM IN WALLET...";
  if (state.plan) return state.plan.preview?.needsApproval ? "APPROVE TICKET" : "CONFIRM TICKET";
  if (state.status === "planning") return "REVIEWING TICKET...";
  return "PLACE BET";
}

export function isPlaceBetButtonDisabled({
  gameSlug,
  isPending,
  winChance,
  state
}: {
  gameSlug: string;
  isPending: boolean;
  winChance: number;
  state: GameBetPanelState;
}) {
  return (
    isPending ||
    state.status === "planning" ||
    state.status === "submitting" ||
    state.status === "mined" ||
    (gameSlug !== "dice" && winChance === 0)
  );
}

export function GameRoomBetPanel({
  game,
  themeColor,
  walletBalance,
  isSynced,
  betAmount,
  onBetAmountChange,
  betCount,
  onBetCountChange,
  stopGain,
  onStopGainChange,
  stopLoss,
  onStopLossChange,
  advancedOpen,
  onAdvancedOpenChange,
  isPending,
  state,
  hasAccount,
  winChance,
  multiplier,
  expectedPayout,
  coinSide,
  onCoinSideChange,
  rouletteSpots,
  onRouletteClear,
  kenoSpots,
  onKenoChange,
  onKenoResetResult,
  onPlaceBet
}: {
  game: GameMeta;
  themeColor: string;
  walletBalance: string | null;
  isSynced: boolean;
  betAmount: number;
  onBetAmountChange: (amount: number) => void;
  betCount: number;
  onBetCountChange: (count: number) => void;
  stopGain: number;
  onStopGainChange: (amount: number) => void;
  stopLoss: number;
  onStopLossChange: (amount: number) => void;
  advancedOpen: boolean;
  onAdvancedOpenChange: (open: boolean) => void;
  isPending: boolean;
  state: GameBetPanelState;
  hasAccount: boolean;
  winChance: number;
  multiplier: number;
  expectedPayout: number;
  coinSide: CoinSide;
  onCoinSideChange: (side: CoinSide) => void;
  rouletteSpots: readonly string[];
  onRouletteClear: () => void;
  kenoSpots: readonly number[];
  onKenoChange: (spots: number[]) => void;
  onKenoResetResult: () => void;
  onPlaceBet: () => void;
}) {
  const setRoundedBetAmount = (value: number) => {
    onBetAmountChange(Math.floor(Math.max(1, value)));
  };

  const placeBetDisabled = isPlaceBetButtonDisabled({
    gameSlug: game.slug,
    isPending,
    winChance,
    state
  });

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <span className="text-sm font-bold text-white/60 flex items-center gap-2">
          <WalletIcon className="w-4 h-4" /> Wallet Balance
        </span>
        <span className="font-mono text-white bg-white/5 py-1 px-3 rounded-lg border border-white/10 shadow-inner">
          {!isSynced ? "Syncing..." : (walletBalance ?? "-")}
        </span>
      </div>

      {game.slug === "roulette" && (
        <RouletteSelectionPanel spots={rouletteSpots} onClear={onRouletteClear} />
      )}

      {game.slug === "coin-toss" && (
        <CoinSideSelector coinSide={coinSide} onChange={onCoinSideChange} />
      )}

      {game.slug === "keno" && (
        <KenoSelectionPanel
          spots={kenoSpots}
          onChange={onKenoChange}
          onResetResult={onKenoResetResult}
        />
      )}

      <div className="mb-6">
        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">
          Bet Amount
        </label>
        <div
          className={cn(
            "bg-[#050505] border border-white/10 rounded-[1.5rem] p-2 flex flex-col gap-2 relative shadow-inner",
            isPending ? "opacity-50" : "focus-within:border-white/20"
          )}
        >
          <div className="flex items-center px-4 pt-2">
            <CurrencyDollarIcon className="w-6 h-6 text-white/20" />
            <input
              type="number"
              value={betAmount}
              onChange={(event) =>
                onBetAmountChange(Math.max(1, parseInt(event.target.value) || 0))
              }
              className="bg-transparent border-none outline-none text-4xl font-mono text-white w-full pr-2 text-right"
            />
          </div>
          <div className="flex gap-1 p-1 bg-white/[0.02] rounded-xl border border-white/5">
            <button
              type="button"
              onClick={() => setRoundedBetAmount(1)}
              className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase font-bold text-white/40 hover:text-white transition-all"
            >
              Min
            </button>
            <button
              type="button"
              onClick={() => setRoundedBetAmount(betAmount / 2)}
              className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase font-bold text-white/40 hover:text-white transition-all"
            >
              1/2
            </button>
            <button
              type="button"
              onClick={() => setRoundedBetAmount(betAmount * 2)}
              className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase font-bold text-white/40 hover:text-white transition-all"
            >
              2x
            </button>
            <button
              type="button"
              onClick={() => {
                const rawBalance = walletBalance
                  ? parseFloat(walletBalance.replace(/,/g, "").replace(" USDC", ""))
                  : 1450;
                setRoundedBetAmount(rawBalance);
              }}
              className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase font-bold text-white/40 hover:text-white transition-all"
            >
              Max
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40">
            Rolls
          </label>
          {betCount > 1 && (
            <span className="text-[10px] font-mono text-white/30">
              Total: {(betAmount * betCount).toLocaleString()} USDC
            </span>
          )}
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 5, 10].map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => onBetCountChange(count)}
              disabled={isPending}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide border transition-all",
                betCount === count
                  ? themeColor === "purple"
                    ? "bg-purple-600 border-purple-400 text-white shadow-[0_0_12px_rgba(147,51,234,0.4)]"
                    : themeColor === "emerald"
                      ? "bg-emerald-600 border-emerald-400 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                      : themeColor === "amber"
                        ? "bg-amber-500 border-amber-300 text-amber-950 shadow-[0_0_12px_rgba(245,158,11,0.4)]"
                        : "bg-fuchsia-600 border-fuchsia-400 text-white shadow-[0_0_12px_rgba(217,70,239,0.4)]"
                  : "bg-[#0a0a0a] border-white/10 text-white/40 hover:border-white/20 hover:text-white"
              )}
            >
              {count === 1 ? "1x" : `${count}x`}
            </button>
          ))}
          <input
            type="number"
            min={1}
            max={100}
            value={betCount}
            onChange={(event) =>
              onBetCountChange(Math.max(1, Math.min(100, parseInt(event.target.value) || 1)))
            }
            disabled={isPending}
            className="w-14 text-center bg-[#0a0a0a] border border-white/10 rounded-xl text-xs font-mono text-white focus:border-white/30 focus:outline-none"
          />
        </div>
      </div>

      <div className="mb-6">
        <button
          type="button"
          onClick={() => onAdvancedOpenChange(!advancedOpen)}
          className="w-full flex justify-between items-center text-[10px] uppercase tracking-widest font-bold text-white/25 hover:text-white/50 transition-colors pb-2 border-b border-white/5"
        >
          <span>Advanced</span>
          <ChevronDownIcon
            className={cn(
              "h-3 w-3 transition-transform duration-200",
              advancedOpen && "rotate-180"
            )}
          />
        </button>
        {advancedOpen && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold text-white/30 tracking-widest">
                Stop Gain (USDC)
              </label>
              <input
                type="number"
                min={0}
                value={stopGain}
                onChange={(event) =>
                  onStopGainChange(Math.max(0, parseInt(event.target.value) || 0))
                }
                placeholder="0 = off"
                className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-white focus:border-emerald-500/40 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold text-white/30 tracking-widest">
                Stop Loss (USDC)
              </label>
              <input
                type="number"
                min={0}
                value={stopLoss}
                onChange={(event) =>
                  onStopLossChange(Math.max(0, parseInt(event.target.value) || 0))
                }
                placeholder="0 = off"
                className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-white focus:border-red-500/40 focus:outline-none"
              />
            </div>
            {(stopGain > 0 || stopLoss > 0) && (
              <div className="col-span-2 text-[9px] text-white/20 font-mono">
                {stopGain > 0 && (
                  <span className="text-emerald-400/50">Gain stop at +{stopGain} USDC</span>
                )}
                {stopGain > 0 && stopLoss > 0 && <span className="mx-2">|</span>}
                {stopLoss > 0 && (
                  <span className="text-red-400/50">Loss stop at {stopLoss} USDC</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-auto">
        <div className="bg-[#050505] p-4 rounded-2xl border border-white/10 flex flex-col shadow-inner">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1 flex items-center gap-1">
            Multiplier <InformationCircleIcon className="w-3 h-3" />
          </span>
          <span
            className={cn(
              "text-2xl font-mono font-bold transition-all",
              themeColor === "emerald"
                ? "text-emerald-400"
                : themeColor === "purple"
                  ? "text-purple-400"
                  : "text-amber-400"
            )}
          >
            {multiplier.toFixed(2)}x
          </span>
        </div>
        <div className="bg-[#050505] p-4 rounded-2xl border border-white/10 flex flex-col shadow-inner">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1 flex items-center gap-1">
            Win Chance <ChartBarIcon className="w-3 h-3" />
          </span>
          <span className="text-2xl font-mono font-bold text-white">{winChance.toFixed(2)}%</span>
        </div>
        <div className="col-span-2 bg-[#050505] p-4 rounded-2xl border border-white/10 flex flex-col shadow-[inset_0_2px_15px_rgba(0,0,0,0.5)] select-none">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1">
            Expected Payout
          </span>
          <span
            className={cn(
              "text-3xl font-mono font-extrabold flex items-baseline gap-2",
              themeColor === "emerald"
                ? "text-emerald-400"
                : themeColor === "purple"
                  ? "text-purple-400"
                  : themeColor === "amber"
                    ? "text-amber-400"
                    : "text-fuchsia-400"
            )}
          >
            {expectedPayout.toFixed(2)}{" "}
            <span
              className={cn(
                "text-sm font-bold",
                themeColor === "emerald"
                  ? "text-emerald-500/50"
                  : themeColor === "purple"
                    ? "text-purple-500/50"
                    : themeColor === "amber"
                      ? "text-amber-500/50"
                      : "text-fuchsia-500/50"
              )}
            >
              USDC
            </span>
          </span>
        </div>
      </div>

      {state.status === "failed" && state.error?.message && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3 text-red-400">
          <InformationCircleIcon className="w-5 h-5 flex-shrink-0" />
          <div className="text-xs font-bold font-mono">{state.error.message}</div>
        </div>
      )}

      <button
        type="button"
        onClick={onPlaceBet}
        disabled={placeBetDisabled}
        className={cn(
          "mt-8 w-full py-6 rounded-2xl text-white font-extrabold text-xl shadow-2xl transition-all border-b-[4px]",
          isPending ||
            state.status === "reconciled" ||
            state.status === "submitting" ||
            state.status === "mined" ||
            state.status === "planning"
            ? "bg-[#111] opacity-50 cursor-not-allowed border-black text-white/50 shadow-none hover:bg-[#111]"
            : state.status === "failed"
              ? "bg-red-600 border-red-800 text-white hover:bg-red-500"
              : game.slug === "dice"
                ? "bg-purple-600 border-purple-800 text-white hover:bg-purple-500"
                : game.slug === "roulette"
                  ? "bg-emerald-600 border-emerald-800 text-white hover:bg-emerald-500"
                  : game.slug === "coin-toss"
                    ? coinSide === "HEADS"
                      ? "bg-amber-500 border-amber-700 text-amber-950 hover:bg-amber-400"
                      : "bg-indigo-600 border-indigo-800 text-white hover:bg-indigo-500"
                    : "bg-fuchsia-600 border-fuchsia-800 text-white hover:bg-fuchsia-500"
        )}
      >
        {getPlaceBetButtonLabel({ hasAccount, state, isPending })}
      </button>
    </>
  );
}
