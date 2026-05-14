import * as React from "react";
import { InformationCircleIcon, WalletIcon } from "@heroicons/react/24/outline";

import { BetAdvancedSection } from "./bet-advanced-section";
import { BetAmountSection } from "./bet-amount-section";
import { BetPayoutSummary } from "./bet-payout-summary";
import { BetRollsSection } from "./bet-rolls-section";
import type { GameRoomBetPanelState } from "./bet-panel-state";
import { GameSelectionControls } from "./game-selection-controls";
import type { GameMeta } from "./model";
import type { CoinSide } from "./params";
import { PlaceBetButton } from "./place-bet-button";

export type { GameRoomBetPanelState } from "./bet-panel-state";
export { getPlaceBetButtonLabel, isPlaceBetButtonDisabled } from "./place-bet-button";

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
  state: GameRoomBetPanelState;
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

      <GameSelectionControls
        game={game}
        coinSide={coinSide}
        onCoinSideChange={onCoinSideChange}
        rouletteSpots={rouletteSpots}
        onRouletteClear={onRouletteClear}
        kenoSpots={kenoSpots}
        onKenoChange={onKenoChange}
        onKenoResetResult={onKenoResetResult}
      />

      <BetAmountSection
        betAmount={betAmount}
        walletBalance={walletBalance}
        isPending={isPending}
        onBetAmountChange={onBetAmountChange}
      />

      <BetRollsSection
        betAmount={betAmount}
        betCount={betCount}
        isPending={isPending}
        themeColor={themeColor}
        onBetCountChange={onBetCountChange}
      />

      <BetAdvancedSection
        advancedOpen={advancedOpen}
        stopGain={stopGain}
        stopLoss={stopLoss}
        onAdvancedOpenChange={onAdvancedOpenChange}
        onStopGainChange={onStopGainChange}
        onStopLossChange={onStopLossChange}
      />

      <BetPayoutSummary
        themeColor={themeColor}
        multiplier={multiplier}
        winChance={winChance}
        expectedPayout={expectedPayout}
      />

      {state.status === "failed" && state.error?.message && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3 text-red-400">
          <InformationCircleIcon className="w-5 h-5 flex-shrink-0" />
          <div className="text-xs font-bold font-mono">{state.error.message}</div>
        </div>
      )}

      <PlaceBetButton
        gameSlug={game.slug}
        coinSide={coinSide}
        hasAccount={hasAccount}
        isPending={isPending}
        winChance={winChance}
        state={state}
        onClick={onPlaceBet}
      />
    </>
  );
}
