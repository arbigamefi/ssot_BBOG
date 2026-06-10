import * as React from "react";
import { useTranslations } from "next-intl";
import { InformationCircleIcon, WalletIcon } from "@heroicons/react/24/outline";
import { AssetSelector, cn, type AssetOption } from "@ssot/ui";

import { TokenLogo } from "../../../components/TokenLogo";
import {
  BetAdvancedSection,
  BetAmountSection,
  BetPayoutSummary,
  BetRollsSection
} from "./bet-panel-sections";
import { isBetAmountAboveMax, isBetAmountUnavailable, resolveBetMaxRaw } from "./bet-amount";
import type { GameMeta } from "./model";
import type { GameRoomBetPanelState, PlaceBetButtonPhase } from "./place-bet-button";
import { PlaceBetButton } from "./place-bet-button";
import type { CasinoRoundPhase } from "./casino-round";
import { CasinoRoundStatusPanel } from "./round-status-panel";
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
  maxBetLabel,
  maxBetIsHint = false,
  maxPayoutLabel,
  maxPayoutIsHint = false,
  betAmount,
  maxBetRaw,
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
  vrfQuote,
  activeBetId,
  activeRequestId,
  roundPhase,
  ctaPhase,
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
  /** Display limit for the selected asset/pool. Shown in compact mobile panel context. */
  maxBetLabel: string;
  maxBetIsHint?: boolean;
  /** Maximum payout supported by the selected pool. */
  maxPayoutLabel: string;
  maxPayoutIsHint?: boolean;
  betAmount: string;
  /** Per-roll amount cap derived from wallet balance and current pool liquidity. */
  maxBetRaw?: bigint;
  onBetAmountChange: (amount: string) => void;
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
  /** Latest VRF fee quote shown as chain/protocol context, not as a workflow step. */
  vrfQuote?: bigint;
  /** Active bet id when the round has been broadcast/mined. */
  activeBetId?: bigint;
  /** Chainlink VRF request id once emitted by the contract. */
  activeRequestId?: bigint;
  roundPhase: CasinoRoundPhase;
  /** Player-facing button phase. May include frontend-only reveal animation. */
  ctaPhase?: PlaceBetButtonPhase;
  manualSettleAvailable?: boolean;
  onManualSettle?: () => void;
  manualRefundAvailable?: boolean;
  onManualRefund?: () => void;
  hideMobileAction?: boolean;
  onPlaceBet: () => void;
}) {
  const t = useTranslations();
  const primaryAction =
    manualRefundAvailable && onManualRefund
      ? onManualRefund
      : manualSettleAvailable && onManualSettle
        ? onManualSettle
        : onPlaceBet;
  const balanceLabel = !hasAccount
    ? t("casino.room.betPanel.notConnected")
    : (walletBalance?.label ?? "—");
  const walletBalanceRaw = walletBalance?.raw ?? null;
  const effectiveMaxRaw = resolveBetMaxRaw(walletBalanceRaw, maxBetRaw);
  const amountUnavailable = isBetAmountUnavailable(assetDecimals, effectiveMaxRaw);
  const amountExceedsMax = isBetAmountAboveMax(betAmount, assetDecimals, effectiveMaxRaw);
  const controlsLocked = isPending && state.status !== "failed";
  const limitValueClass = (isHint: boolean) =>
    cn("mt-0.5 truncate text-xs font-bold", isHint ? "text-fg-muted" : "font-mono text-fg");

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
                  disabled={controlsLocked}
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
            <div
              className="min-w-0 text-right"
              role="group"
              aria-label={t("casino.room.betPanel.walletBalance")}
            >
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

          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border-soft pt-2 lg:hidden">
            <div className="min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-fg-subtle">
                {t("casino.room.betPanel.limits.maxBet")}
              </div>
              <div
                className={limitValueClass(maxBetIsHint)}
                title={typeof maxBetLabel === "string" ? maxBetLabel : undefined}
              >
                {maxBetLabel}
              </div>
            </div>
            <div className="min-w-0 text-right">
              <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-fg-subtle">
                {t("casino.room.betPanel.limits.poolPayout")}
              </div>
              <div
                className={limitValueClass(maxPayoutIsHint)}
                title={typeof maxPayoutLabel === "string" ? maxPayoutLabel : undefined}
              >
                {maxPayoutLabel}
              </div>
            </div>
          </div>
        </div>

        {!hasAccount && (
          <div
            className={cn(
              "mb-2 rounded-lg border border-brand/30 bg-brand-soft p-3",
              hideMobileAction && "hidden lg:block"
            )}
          >
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

        <div data-tour="bet-amount" className={cn(hideMobileAction && "hidden lg:block")}>
          <BetAmountSection
            betAmount={betAmount}
            maxBetRaw={maxBetRaw}
            walletBalanceRaw={walletBalanceRaw}
            assetDecimals={assetDecimals}
            assetSymbol={assetSymbol}
            isPending={controlsLocked}
            onBetAmountChange={onBetAmountChange}
          />
        </div>

        <BetRollsSection
          betAmount={betAmount}
          betCount={betCount}
          assetDecimals={assetDecimals}
          assetSymbol={assetSymbol}
          isPending={controlsLocked}
          onBetCountChange={onBetCountChange}
        />

        <BetAdvancedSection
          advancedOpen={advancedOpen}
          assetSymbol={assetSymbol}
          isPending={controlsLocked}
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
          betId={activeBetId}
          requestId={activeRequestId}
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
          roundPhase={ctaPhase ?? roundPhase}
          manualSettleAvailable={manualSettleAvailable}
          manualRefundAvailable={manualRefundAvailable}
          amountUnavailable={amountUnavailable}
          amountExceedsMax={amountExceedsMax}
          onClick={primaryAction}
        />
      </div>
    </div>
  );
}
