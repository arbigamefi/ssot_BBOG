"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Address } from "@ssot/ssot/sdk";

import { PageTransition } from "../../../components/PageTransition";
import { ProductStateCard } from "../../../components/ProductStateCard";
import { StickyActionBar } from "../../../components/overlay/StickyActionBar";
import { BankProviderLedgerPanel } from "../../../features/earn/BankProviderLedgerPanel";
import { BankrollPerformancePanel } from "../../../features/earn/BankrollPerformancePanel";
import { EarnActionPanel, type EarnFlowState } from "../../../features/earn/earn-action-panel";
import { EarnBankSummary } from "../../../features/earn/earn-bank-summary";
import { EarnHero } from "../../../features/earn/earn-hero";
import { EarnRiskPanel } from "../../../features/earn/earn-risk-panel";
import {
  formatHoldPercent,
  formatMultiple,
  formatTokenAmount,
  getExplorerBaseUrl,
  shortHex
} from "../../../features/earn/format";
import type {
  EarnAmountMode,
  EarnBankData,
  EarnMetric,
  EarnTab
} from "../../../features/earn/types";
import { useBankProviderLedger } from "../../../features/earn/useBankProviderLedger";
import { useCasinoPoolAssetSelection } from "../../../features/assets/useCasinoPoolAssetSelection";
import { formatUnits, parseDecimalToUnits } from "../../../features/betting/model/units";
import { useDirectTxAction, useSequencedTxAction } from "../../../features/tx/useDirectTxAction";
import { useRelease } from "../../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../../ssot/sdk";
import { toast } from "@ssot/ui";

const ZERO_ADDRESS = `0x${"0".repeat(40)}` as Address;
const ALLOWANCE_NOT_CONFIRMED = "ALLOWANCE_NOT_CONFIRMED";

export function EarnPageClient() {
  const t = useTranslations();
  const { release, readOnly, readOnlyReason, chainId } = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const queryClient = useQueryClient();
  const explorerBaseUrl = React.useMemo(() => getExplorerBaseUrl(chainId), [chainId]);

  // Shared asset-selection model (also used by the casino room) — lists every
  // active casino pool asset on the current chain and resolves the chosen one to
  // a pool id + decimals + symbol. `selectedContext` is the "valid asset" guard.
  const assetSelection = useCasinoPoolAssetSelection();
  const { assetOptions, selectedContext, poolId } = assetSelection;
  const writesSupportedForSelectedAsset = assetSelection.writesSupported;
  const asset = assetSelection.selectedAsset ?? ZERO_ADDRESS;
  const setAsset = assetSelection.setSelectedAsset;
  const decimals = assetSelection.decimals ?? 18;
  const symbol = assetSelection.symbol ?? t("earn.format.assetFallback");

  const {
    data: bankData,
    isLoading,
    error: loadError
  } = useQuery({
    queryKey: ["ssot", "earn", "bank", chainId, poolId, sdk?.account ?? "anonymous"],
    enabled: Boolean(sdk && ready && selectedContext && poolId),
    queryFn: async (): Promise<EarnBankData> => {
      if (!sdk) throw new Error(t("earn.errors.sdkUnavailable"));
      if (!poolId) throw new Error(t("earn.errors.poolUnavailable"));
      const snapshot = await sdk.bank.getSnapshot(poolId);
      const position = sdk.account ? await sdk.bank.getPosition(poolId, sdk.account) : null;
      return { snapshot, position };
    },
    refetchInterval: 8_000
  });

  const [tab, setTab] = React.useState<EarnTab>("deposit");
  const [amountMode, setAmountMode] = React.useState<EarnAmountMode>("assets");
  const [diligenceTab, setDiligenceTab] = React.useState<"reserve" | "risk">("reserve");
  const [amount, setAmount] = React.useState("");
  const actionPanelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setAmount("");
  }, [tab, amountMode, asset]);

  const focusActionPanel = React.useCallback((nextTab: EarnTab) => {
    setTab(nextTab);
    window.requestAnimationFrame(() => {
      actionPanelRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      actionPanelRef.current?.focus({ preventScroll: true });
    });
  }, []);

  const depositFlow = useSequencedTxAction({
    finalAction: "DEPOSIT",
    errorMessage: t("app.errors.transactionFailed"),
    steps: [
      {
        key: "preflight",
        title: t("earn.flows.preflight.title"),
        description: t("earn.flows.deposit.preflight")
      },
      {
        key: "approve",
        title: t("earn.flows.deposit.approveTitle"),
        description: t("earn.flows.deposit.approveDescription"),
        action: "APPROVE_DEPOSIT",
        optional: true
      },
      {
        key: "deposit",
        title: t("earn.flows.deposit.depositTitle"),
        description: t("earn.flows.deposit.depositDescription"),
        action: "DEPOSIT"
      }
    ]
  });

  const mintFlow = useSequencedTxAction({
    finalAction: "MINT",
    errorMessage: t("app.errors.transactionFailed"),
    steps: [
      {
        key: "preflight",
        title: t("earn.flows.preflight.title"),
        description: t("earn.flows.mint.preflight")
      },
      {
        key: "approve",
        title: t("earn.flows.deposit.approveTitle"),
        description: t("earn.flows.deposit.approveDescription"),
        action: "APPROVE_MINT",
        optional: true
      },
      {
        key: "mint",
        title: t("earn.flows.mint.mintTitle"),
        description: t("earn.flows.mint.mintDescription"),
        action: "MINT"
      }
    ]
  });

  const withdrawFlow = useDirectTxAction({
    action: "WITHDRAW",
    errorMessage: t("app.errors.transactionFailed"),
    labels: {
      preflight: t("earn.flows.preflight.title"),
      submit: t("earn.flows.direct.submit"),
      confirm: t("earn.flows.direct.confirm")
    },
    descriptions: {
      preflight: t("earn.flows.direct.validate"),
      submit: t("earn.flows.withdraw.submit"),
      confirm: t("earn.flows.direct.receipt")
    }
  });

  const redeemFlow = useDirectTxAction({
    action: "REDEEM",
    errorMessage: t("app.errors.transactionFailed"),
    labels: {
      preflight: t("earn.flows.preflight.title"),
      submit: t("earn.flows.direct.submit"),
      confirm: t("earn.flows.direct.confirm")
    },
    descriptions: {
      preflight: t("earn.flows.direct.validate"),
      submit: t("earn.flows.redeem.submit"),
      confirm: t("earn.flows.direct.receipt")
    }
  });

  const currentFlow =
    tab === "deposit"
      ? amountMode === "shares"
        ? mintFlow
        : depositFlow
      : amountMode === "shares"
        ? redeemFlow
        : withdrawFlow;
  const flow: EarnFlowState = {
    status: currentFlow.status,
    steps: currentFlow.steps,
    hasActivity: currentFlow.hasActivity,
    busy: currentFlow.busy,
    error: currentFlow.error,
    txHash: currentFlow.txHash,
    blockNumber: currentFlow.journalEntry?.blockNumber,
    reset: currentFlow.reset
  };

  const { data: walletBalance = null } = useQuery({
    queryKey: ["ssot", "earn", "walletBalance", chainId, asset, sdk?.account],
    enabled: Boolean(sdk?.account && selectedContext && ready),
    queryFn: async () => {
      if (!sdk?.account) return null;
      return sdk.bank.getAssetBalance(asset, sdk.account);
    },
    refetchInterval: currentFlow.busy ? false : 5_000
  });

  const { data: maxWithdraw = null } = useQuery({
    queryKey: ["ssot", "earn", "maxWithdraw", chainId, poolId, sdk?.account],
    enabled: Boolean(
      sdk?.account &&
      tab === "withdraw" &&
      amountMode === "assets" &&
      writesSupportedForSelectedAsset
    ),
    queryFn: async () => {
      if (!sdk?.account || !poolId) return null;
      return sdk.bank.maxWithdraw(poolId, sdk.account);
    },
    refetchInterval: currentFlow.busy ? false : 5_000
  });

  const { data: maxRedeem = null } = useQuery({
    queryKey: ["ssot", "earn", "maxRedeem", chainId, poolId, sdk?.account],
    enabled: Boolean(
      sdk?.account &&
      tab === "withdraw" &&
      amountMode === "shares" &&
      writesSupportedForSelectedAsset
    ),
    queryFn: async () => {
      if (!sdk?.account || !poolId) return null;
      return sdk.bank.maxRedeem(poolId, sdk.account);
    },
    refetchInterval: currentFlow.busy ? false : 5_000
  });

  const { data: maxMintShares = null } = useQuery({
    queryKey: ["ssot", "earn", "maxMintShares", chainId, poolId, walletBalance?.toString()],
    enabled: Boolean(
      sdk?.account &&
      poolId &&
      walletBalance != null &&
      tab === "deposit" &&
      amountMode === "shares" &&
      writesSupportedForSelectedAsset
    ),
    queryFn: async () => {
      if (!poolId || walletBalance == null) return null;
      return sdk!.bank.convertToShares(poolId, walletBalance);
    },
    refetchInterval: currentFlow.busy ? false : 5_000
  });

  const providerLedger = useBankProviderLedger({
    enabled: Boolean(ready && poolId && selectedContext),
    poolId,
    sdk
  });

  const maxActionAmount =
    tab === "deposit"
      ? amountMode === "shares"
        ? maxMintShares
        : walletBalance
      : amountMode === "shares"
        ? maxRedeem
        : maxWithdraw;
  const availableUnit = amountMode === "shares" ? t("earn.units.sharesLower") : symbol;
  const availableLabel =
    tab === "deposit"
      ? amountMode === "shares"
        ? t("earn.actions.balance.mintable")
        : t("earn.actions.balance.wallet")
      : amountMode === "shares"
        ? t("earn.actions.balance.redeemable")
        : t("earn.actions.balance.withdrawable");
  const availableValue =
    maxActionAmount == null
      ? t("earn.actions.balance.pending")
      : formatTokenAmount(maxActionAmount, decimals, availableUnit, 4);

  const handleUseMax = React.useCallback(() => {
    if (tab === "deposit" && amountMode === "assets" && walletBalance != null) {
      setAmount(formatUnits(walletBalance, decimals));
    }
    if (tab === "deposit" && amountMode === "shares" && maxMintShares != null) {
      setAmount(formatUnits(maxMintShares, decimals));
    }
    if (tab === "withdraw" && amountMode === "assets" && maxWithdraw != null) {
      setAmount(formatUnits(maxWithdraw, decimals));
    }
    if (tab === "withdraw" && amountMode === "shares" && maxRedeem != null) {
      setAmount(formatUnits(maxRedeem, decimals));
    }
  }, [amountMode, decimals, maxMintShares, maxRedeem, maxWithdraw, tab, walletBalance]);

  const handleSubmit = React.useCallback(async () => {
    if (!sdk?.account) {
      toast.error(t("earn.actions.connectWallet"));
      return;
    }
    if (readOnly) {
      toast.error(t("earn.actions.readOnly"));
      return;
    }

    if (!writesSupportedForSelectedAsset || !poolId) {
      toast.error(t("earn.errors.unsupportedWriteAsset"));
      return;
    }

    try {
      const parsed = parseDecimalToUnits(amount, decimals);
      if (parsed <= 0n) {
        toast.error(t("earn.errors.positiveAmount"));
        return;
      }

      const account = sdk.account;
      const freshWalletBalance =
        tab === "deposit" ? await sdk.bank.getAssetBalance(asset, account) : null;
      const freshAvailableForTab =
        tab === "deposit"
          ? amountMode === "shares"
            ? await sdk.bank.convertToShares(poolId, freshWalletBalance ?? 0n)
            : (freshWalletBalance ?? 0n)
          : amountMode === "shares"
            ? await sdk.bank.maxRedeem(poolId, account)
            : await sdk.bank.maxWithdraw(poolId, account);
      if (parsed > freshAvailableForTab) {
        toast.error(
          tab === "deposit"
            ? amountMode === "shares"
              ? t("earn.errors.exceedsMintable")
              : t("earn.errors.insufficientWalletBalance")
            : amountMode === "shares"
              ? t("earn.errors.exceedsRedeemable")
              : t("earn.errors.exceedsWithdrawable")
        );
        return;
      }

      const toastId = toast.loading(t("earn.toast.processing"));
      const result =
        tab === "deposit"
          ? amountMode === "shares"
            ? await mintFlow.execute(() => sdk.bank.mint(poolId, parsed, account))
            : await depositFlow.execute(() => sdk.bank.deposit(poolId, parsed, account))
          : amountMode === "shares"
            ? await redeemFlow.execute(() => sdk.bank.redeem(poolId, parsed, account, account))
            : await withdrawFlow.execute(() => sdk.bank.withdraw(poolId, parsed, account, account));

      if (!result.ok) {
        toast.dismiss(toastId);
        toast.error(
          result.error?.code === ALLOWANCE_NOT_CONFIRMED
            ? t("earn.errors.allowanceNotConfirmed")
            : (result.error?.message ?? t("earn.toast.failed"))
        );
        return;
      }

      toast.success(
        amountMode === "shares"
          ? t(tab === "deposit" ? "earn.toast.minted" : "earn.toast.redeemed", {
              amount: formatUnits(parsed, decimals)
            })
          : t(tab === "deposit" ? "earn.toast.deposited" : "earn.toast.withdrew", {
              amount: formatUnits(parsed, decimals),
              symbol
            }),
        {
          description:
            explorerBaseUrl && result.txHash !== "0x0" ? (
              <a
                href={`${explorerBaseUrl}/tx/${result.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-brand hover:text-brand-hover"
              >
                {t("earn.toast.viewTransaction")}
              </a>
            ) : undefined,
          id: toastId
        }
      );
      setAmount("");
      await queryClient.invalidateQueries({ queryKey: ["ssot", "earn"] });
    } catch (error) {
      toast.error((error as Error)?.message ?? t("earn.toast.failed"));
    }
  }, [
    amount,
    amountMode,
    asset,
    decimals,
    depositFlow,
    explorerBaseUrl,
    maxMintShares,
    maxRedeem,
    maxWithdraw,
    mintFlow,
    queryClient,
    readOnly,
    redeemFlow,
    sdk,
    symbol,
    tab,
    withdrawFlow,
    walletBalance,
    poolId,
    t,
    writesSupportedForSelectedAsset
  ]);

  if (!release) {
    return (
      <ProductStateCard
        title={t("earn.state.noRelease.title")}
        description={readOnlyReason ?? t("earn.state.noRelease.description")}
      />
    );
  }

  const snapshot = bankData?.snapshot;
  const houseRevenue =
    snapshot?.totalTurnover != null && snapshot.totalPayoutGross != null
      ? snapshot.totalTurnover - snapshot.totalPayoutGross
      : undefined;
  const realizedHold =
    houseRevenue != null && snapshot?.totalTurnover != null
      ? formatHoldPercent(houseRevenue, snapshot.totalTurnover)
      : null;
  const capitalVelocity =
    snapshot?.totalTurnover != null
      ? formatMultiple(snapshot.totalTurnover, snapshot.totalAssets)
      : null;

  const metrics: EarnMetric[] = [
    {
      label: t("earn.metrics.sharePrice.label"),
      value: formatTokenAmount(snapshot?.assetsPerShare, decimals, symbol, 4),
      detail: t("earn.metrics.sharePrice.detail")
    },
    {
      label: t("earn.metrics.totalShares.label"),
      value: formatTokenAmount(snapshot?.totalSupply, decimals, undefined, 2),
      detail: t("earn.metrics.totalShares.detail")
    },
    {
      label: t("earn.performance.velocity"),
      value: capitalVelocity ?? "—",
      detail: t("earn.performance.onChain")
    },
    {
      label: t("earn.performance.hold"),
      value: realizedHold ?? "—",
      detail: t("earn.performance.onChain")
    }
  ];

  return (
    <PageTransition pageKey="earn">
      <div className="space-y-8 pb-28 lg:pb-0">
        <EarnHero symbol={symbol} bankAddress={shortHex(snapshot?.bank)} metrics={metrics} />
        {/* Provider diligence: how the house bankroll has actually performed
            (indexed, best-effort) — shown before the deposit console so a
            provider sees the evidence before they act. */}
        <BankrollPerformancePanel
          assetAddress={asset}
          assetDecimals={decimals}
          assetSymbol={symbol}
          chainPerformance={snapshot}
          sharePrice={snapshot?.assetsPerShare}
          vaultAssets={snapshot?.totalAssets}
        />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
          <section className="min-w-0 rounded-md border border-border bg-surface-1 shadow-e2 xl:col-start-1 xl:row-start-1">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div className="grid min-w-0 grid-cols-2 gap-1 rounded-md border border-border-soft bg-surface-0 p-1">
                {[
                  {
                    key: "reserve" as const,
                    label: t("earn.summary.capitalPosture.title")
                  },
                  {
                    key: "risk" as const,
                    label: t("earn.risk.title")
                  }
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setDiligenceTab(item.key)}
                    className={`min-w-0 rounded-sm px-2 py-2 text-[11px] font-bold uppercase tracking-[0.08em] transition sm:px-3 sm:text-xs sm:tracking-[0.12em] ${
                      diligenceTab === item.key
                        ? "bg-brand text-fg-inverse"
                        : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                    }`}
                  >
                    <span className="block truncate">{item.label}</span>
                  </button>
                ))}
              </div>
              <span className="rounded-full border border-success/30 bg-success-soft px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-success">
                {diligenceTab === "reserve"
                  ? t("earn.summary.capitalPosture.readModel")
                  : t("earn.risk.readModel")}
              </span>
            </div>
            {diligenceTab === "reserve" ? (
              <EarnBankSummary
                data={bankData}
                decimals={decimals}
                symbol={symbol}
                loading={isLoading}
                error={(loadError as Error | undefined)?.message}
                embedded
              />
            ) : (
              <EarnRiskPanel
                data={bankData}
                decimals={decimals}
                symbol={symbol}
                releaseDigest={release.releaseDigest}
                embedded
              />
            )}
          </section>
          <div
            id="earn-actions"
            ref={actionPanelRef}
            tabIndex={-1}
            className="min-w-0 scroll-mt-24 outline-none xl:sticky xl:top-24 xl:col-start-2 xl:row-span-2 xl:row-start-1"
          >
            <EarnActionPanel
              tab={tab}
              onTabChange={setTab}
              amountMode={amountMode}
              onAmountModeChange={setAmountMode}
              assets={assetOptions}
              asset={asset}
              onAssetChange={setAsset}
              amount={amount}
              onAmountChange={setAmount}
              symbol={symbol}
              disabled={
                readOnly ||
                flow.busy ||
                !sdk?.account ||
                !amount ||
                !writesSupportedForSelectedAsset
              }
              readOnly={readOnly}
              unsupportedAsset={!writesSupportedForSelectedAsset}
              availableLabel={availableLabel}
              availableValue={availableValue}
              canUseMax={maxActionAmount != null && maxActionAmount > 0n && !flow.busy}
              onUseMax={handleUseMax}
              flow={flow}
              onSubmit={() => void handleSubmit()}
              connected={Boolean(sdk?.account)}
            />
          </div>
          <div className="min-w-0 xl:col-start-1 xl:row-start-2">
            <BankProviderLedgerPanel
              connected={Boolean(sdk?.account)}
              decimals={decimals}
              entries={providerLedger.entries}
              error={(providerLedger.error as Error | undefined)?.message}
              explorerBaseUrl={explorerBaseUrl}
              hasMore={Boolean(providerLedger.hasNextPage)}
              loading={providerLedger.isLoading}
              loadingMore={providerLedger.isFetchingNextPage}
              onLoadMore={() => void providerLedger.fetchNextPage()}
              positionAssets={bankData?.position?.assetsEquivalent}
              positionShares={bankData?.position?.shares}
              symbol={symbol}
            />
          </div>
        </div>
      </div>
      <StickyActionBar innerClassName="grid grid-cols-2 gap-2">
        {(["deposit", "withdraw"] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-controls="earn-actions"
            onClick={() => focusActionPanel(item)}
            className={`min-h-12 rounded-xl border px-4 text-sm font-bold transition-colors ${
              tab === item
                ? "border-brand bg-brand text-fg-inverse"
                : "border-border-soft bg-surface-1 text-fg hover:border-brand/40 hover:bg-brand-soft"
            }`}
          >
            {t(`earn.actions.tabs.${item}.label`)}
          </button>
        ))}
      </StickyActionBar>
    </PageTransition>
  );
}
