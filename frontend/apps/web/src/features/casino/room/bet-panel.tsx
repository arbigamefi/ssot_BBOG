import * as React from "react";
import { InformationCircleIcon, WalletIcon } from "@heroicons/react/24/outline";

import {
  BetAdvancedSection,
  BetAmountSection,
  BetPayoutSummary,
  BetRollsSection
} from "./bet-panel-sections";
import type { GameRoomBetPanelState } from "./bet-panel-state";
import { GameSelectionControls } from "./game-selection-controls";
import type { GameMeta } from "./model";
import type { CoinSide } from "./params";
import { PlaceBetButton } from "./place-bet-button";
import { CasinoRoundStatusPanel } from "./round-status-panel";
import type { CasinoRoundPhase } from "./casino-round";

export type { GameRoomBetPanelState } from "./bet-panel-state";
export { getPlaceBetButtonLabel, isPlaceBetButtonDisabled } from "./place-bet-button";

export function GameRoomBetPanel({
  game,
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
  roundPhase,
  vrfQuote,
  vrfQuoteError,
  activeBetId,
  activeRequestId,
  roundError,
  manualSettleAvailable,
  onManualSettle,
  manualRefundAvailable,
  onManualRefund,
  onPlaceBet
}: {
  game: GameMeta;
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
  roundPhase: CasinoRoundPhase;
  vrfQuote?: bigint;
  vrfQuoteError?: string;
  activeBetId?: bigint;
  activeRequestId?: bigint;
  roundError?: string;
  manualSettleAvailable?: boolean;
  onManualSettle?: () => void;
  manualRefundAvailable?: boolean;
  onManualRefund?: () => void;
  onPlaceBet: () => void;
}) {
  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-bold text-fg-muted">
          <WalletIcon className="h-4 w-4" /> Wallet Balance
        </span>
        <span className="rounded-lg border border-border bg-surface-1 px-3 py-1 font-mono text-fg shadow-inner-e1">
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
        multiplier={multiplier}
        winChance={winChance}
        expectedPayout={expectedPayout}
      />

      {state.status === "failed" && state.error?.message && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-danger/30 bg-danger-soft p-4 text-danger">
          <InformationCircleIcon className="h-5 w-5 flex-shrink-0" />
          <div className="font-mono text-xs font-bold">{state.error.message}</div>
        </div>
      )}

      <CasinoRoundStatusPanel
        phase={roundPhase}
        quote={vrfQuote}
        quoteError={vrfQuoteError}
        betId={activeBetId}
        requestId={activeRequestId}
        error={roundError}
        manualSettleAvailable={manualSettleAvailable}
        onManualSettle={onManualSettle}
        manualRefundAvailable={manualRefundAvailable}
        onManualRefund={onManualRefund}
      />

      <PlaceBetButton
        gameSlug={game.slug}
        hasAccount={hasAccount}
        isPending={isPending}
        winChance={winChance}
        state={state}
        onClick={onPlaceBet}
      />
    </>
  );
}
