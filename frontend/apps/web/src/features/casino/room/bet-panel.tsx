import * as React from "react";
import { useTranslations } from "next-intl";
import { InformationCircleIcon, WalletIcon } from "@heroicons/react/24/outline";
import { AssetSelector, cn, type AssetOption } from "@ssot/ui";

import { formatUnits } from "../../betting/model/units";
import { TokenLogo } from "../../../components/TokenLogo";
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
  maxBetAmount,
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
  /** Per-roll amount cap derived from wallet balance and current pool liquidity. */
  maxBetAmount?: number;
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
        {/* Account context: asset and balance belong together, but should stay
            visually lighter than the actual amount input below. */}
        <div className="mb-2 rounded-xl border border-border bg-surface-0 p-2 shadow-inner-e1">
          <div className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] items-center gap-2">
            <div className="min-w-0">
              {assetOptions && assetOptions.length > 0 ? (
                <AssetSelector
                  variant="inline"
                  assets={assetOptions}
                  value={selectedAsset}
                  onValueChange={onAssetChange}
                  disabled={isPending}
                  title={t("casino.room.betPanel.asset")}
                  renderLogo={(option) => <TokenLogo symbol={option.symbol} size={20} />}
                  className="max-w-full bg-surface-1"
                />
              ) : (
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-fg-subtle">
                  {t("casino.room.betPanel.asset")}
                </span>
              )}
            </div>
            <div className="min-w-0 text-right">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-fg-subtle">
                {t("casino.room.betPanel.walletBalance")}
              </div>
              <div
                className="mt-0.5 truncate font-mono text-sm font-bold text-fg"
                title={balanceLabel}
              >
                {balanceLabel}
              </div>
            </div>
          </div>
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
            maxBetAmount={maxBetAmount}
            walletBalanceAmount={walletBalanceAmount}
            assetSymbol={assetSymbol}
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
