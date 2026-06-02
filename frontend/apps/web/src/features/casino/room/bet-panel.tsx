import * as React from "react";
import { useTranslations } from "next-intl";
import { InformationCircleIcon, WalletIcon } from "@heroicons/react/24/outline";
import { AssetSelector, cn, type AssetOption } from "@ssot/ui";

import { formatUnits } from "../../betting/model/units";
import {
  BetAdvancedSection,
  BetAmountSection,
  BetPayoutSummary,
  BetRollsSection
} from "./bet-panel-sections";
import type { GameMeta } from "./model";
import type { GameRoomBetPanelState } from "./place-bet-button";
import { PlaceBetButton } from "./place-bet-button";
import { CasinoRoundStatusPanel } from "./round-status-panel";
import type { CasinoRoundPhase } from "./casino-round";
import { getStepperErrorMessage } from "./feedback";
import type { GameWalletBalance } from "./hooks";

export type { GameRoomBetPanelState } from "./place-bet-button";
export { isPlaceBetButtonDisabled } from "./place-bet-button";

export function GameRoomBetPanel({
  game,
  walletBalance,
  assetDecimals,
  assetSymbol,
  assetOptions,
  selectedAsset,
  onAssetChange,
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
  hideMobileAction = false,
  onPlaceBet
}: {
  game: GameMeta;
  walletBalance: GameWalletBalance | null;
  assetDecimals: number;
  assetSymbol: string;
  /** Casino pool assets on this chain. A selector renders only when there are 2+. */
  assetOptions?: AssetOption[];
  selectedAsset?: `0x${string}`;
  onAssetChange?: (asset: `0x${string}`) => void;
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
  hideMobileAction?: boolean;
  onPlaceBet: () => void;
}) {
  const t = useTranslations();
  const balanceLabel = !hasAccount
    ? t("casino.room.betPanel.notConnected")
    : (walletBalance?.label ?? "—");
  const walletBalanceAmount =
    walletBalance?.raw == null ? null : Number(formatUnits(walletBalance.raw, assetDecimals));

  return (
    <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden lg:h-full">
      <div className="min-h-0 pb-2 lg:overflow-y-auto lg:pr-1">
        {assetOptions && assetOptions.length > 1 && onAssetChange ? (
          <div className="mb-2">
            <AssetSelector
              title={t("casino.room.betPanel.asset")}
              assets={assetOptions}
              value={selectedAsset}
              onValueChange={onAssetChange}
            />
          </div>
        ) : null}

        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-bold text-fg-muted">
            <WalletIcon className="h-4 w-4" /> {t("casino.room.betPanel.walletBalance")}
          </span>
          <span className="rounded-lg border border-border bg-surface-1 px-3 py-1 font-mono text-fg shadow-inner-e1">
            {balanceLabel}
          </span>
        </div>

        {!hasAccount && (
          <div className="mb-2 rounded-lg border border-brand/30 bg-brand-soft p-3">
            <div className="flex items-start gap-3">
              <WalletIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
              <div>
                <p className="text-sm font-semibold text-fg">
                  {t("casino.room.betPanel.walletGate.title")}
                </p>
              </div>
            </div>
          </div>
        )}

        <div data-tour="bet-amount">
          <BetAmountSection
            betAmount={betAmount}
            walletBalanceAmount={walletBalanceAmount}
            isPending={isPending}
            onBetAmountChange={onBetAmountChange}
          />
        </div>

        <BetRollsSection
          betAmount={betAmount}
          betCount={betCount}
          assetSymbol={assetSymbol}
          isPending={isPending}
          onBetCountChange={onBetCountChange}
        />

        <BetAdvancedSection
          advancedOpen={advancedOpen}
          assetSymbol={assetSymbol}
          isPending={isPending}
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
          assetSymbol={assetSymbol}
        />

        {state.status === "failed" && state.error?.message && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-danger/30 bg-danger-soft p-4 text-danger">
            <InformationCircleIcon className="h-5 w-5 shrink-0" />
            <div className="font-mono text-xs font-bold">
              {getStepperErrorMessage(state.error, t("casino.room.errors.transactionFailed"))}
            </div>
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
      </div>

      <div
        data-tour="place-bet"
        className={cn(
          "-mx-4 mt-2 shrink-0 border-t border-border-soft bg-surface-2/95 px-4 pt-2 shadow-e2 backdrop-blur lg:mx-0 lg:bg-surface-2 lg:px-0 lg:shadow-none",
          hideMobileAction && "hidden lg:block"
        )}
      >
        <PlaceBetButton
          gameSlug={game.slug}
          hasAccount={hasAccount}
          isPending={isPending}
          winChance={winChance}
          state={state}
          onClick={onPlaceBet}
        />
      </div>
    </div>
  );
}
