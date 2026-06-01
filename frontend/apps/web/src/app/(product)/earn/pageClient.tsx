"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Address } from "@ssot/ssot/sdk";
import type { AssetOption } from "@ssot/ui";

import { PageTransition } from "../../../components/PageTransition";
import { ProductStateCard } from "../../../components/ProductStateCard";
import { BankrollPerformancePanel } from "../../../features/earn/BankrollPerformancePanel";
import { EarnActionPanel, type EarnFlowState } from "../../../features/earn/earn-action-panel";
import { EarnBankSummary } from "../../../features/earn/earn-bank-summary";
import { EarnHero } from "../../../features/earn/earn-hero";
import { EarnRiskPanel } from "../../../features/earn/earn-risk-panel";
import { formatTokenAmount, getExplorerBaseUrl, shortHex } from "../../../features/earn/format";
import type { EarnBankData, EarnMetric, EarnTab } from "../../../features/earn/types";
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

  const assetOptions = React.useMemo<AssetOption[]>(
    () =>
      (release?.assets ?? []).map((asset) => ({
        address: asset.address as Address,
        symbol: asset.symbol,
        decimals: asset.decimals,
        label: `${asset.symbol} (${asset.decimals})`
      })),
    [release?.assets]
  );

  const [asset, setAsset] = React.useState<Address>(
    () => (release?.assets[0]?.address as Address | undefined) ?? ZERO_ADDRESS
  );

  React.useEffect(() => {
    const firstAsset = release?.assets[0]?.address as Address | undefined;
    if (firstAsset && asset === ZERO_ADDRESS) setAsset(firstAsset);
  }, [asset, release?.assets]);

  const assetMeta = React.useMemo(
    () => release?.assets.find((item) => item.address.toLowerCase() === asset.toLowerCase()),
    [asset, release?.assets]
  );
  const primaryAsset = release?.assets[0]?.address?.toLowerCase();
  const selectedPool = React.useMemo(
    () =>
      release?.pools.find(
        (pool) =>
          pool.active &&
          pool.asset.toLowerCase() === asset.toLowerCase() &&
          String(pool.domain).toLowerCase() === "casino"
      ) ??
      release?.pools.find(
        (pool) => pool.active && pool.asset.toLowerCase() === asset.toLowerCase()
      ),
    [asset, release?.pools]
  );
  const poolId = selectedPool?.poolId;
  const writesSupportedForSelectedAsset =
    Boolean(poolId) && (!primaryAsset || asset.toLowerCase() === primaryAsset);
  const decimals = assetMeta?.decimals ?? 18;
  const symbol = assetMeta?.symbol ?? t("earn.format.assetFallback");

  const {
    data: bankData,
    isLoading,
    error: loadError
  } = useQuery({
    queryKey: ["ssot", "earn", "bank", chainId, poolId, sdk?.account ?? "anonymous"],
    enabled: Boolean(sdk && ready && assetMeta && poolId),
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
  const [diligenceTab, setDiligenceTab] = React.useState<"reserve" | "risk">("reserve");
  const [amount, setAmount] = React.useState("");

  React.useEffect(() => {
    setAmount("");
  }, [tab, asset]);

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
    tab === "deposit" ? depositFlow : tab === "withdraw" ? withdrawFlow : redeemFlow;
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

  const { data: maxWithdraw = null } = useQuery({
    queryKey: ["ssot", "earn", "maxWithdraw", chainId, poolId, sdk?.account],
    enabled: Boolean(sdk?.account && tab === "withdraw" && writesSupportedForSelectedAsset),
    queryFn: async () => {
      if (!sdk?.account || !poolId) return null;
      return sdk.bank.maxWithdraw(poolId, sdk.account);
    },
    refetchInterval: 5_000
  });

  const { data: maxRedeem = null } = useQuery({
    queryKey: ["ssot", "earn", "maxRedeem", chainId, poolId, sdk?.account],
    enabled: Boolean(sdk?.account && tab === "redeem" && writesSupportedForSelectedAsset),
    queryFn: async () => {
      if (!sdk?.account || !poolId) return null;
      return sdk.bank.maxRedeem(poolId, sdk.account);
    },
    refetchInterval: 5_000
  });

  const { data: walletBalance = null } = useQuery({
    queryKey: ["ssot", "earn", "walletBalance", chainId, asset, sdk?.account],
    enabled: Boolean(sdk?.account && assetMeta && ready),
    queryFn: async () => {
      if (!sdk?.account) return null;
      return sdk.bank.getAssetBalance(asset, sdk.account);
    },
    refetchInterval: 5_000
  });

  const maxActionAmount =
    tab === "deposit" ? walletBalance : tab === "withdraw" ? maxWithdraw : maxRedeem;
  const availableUnit = tab === "redeem" ? t("earn.units.sharesLower") : symbol;
  const availableLabel =
    tab === "deposit"
      ? t("earn.actions.balance.wallet")
      : tab === "withdraw"
        ? t("earn.actions.balance.withdrawable")
        : t("earn.actions.balance.redeemable");
  const availableValue =
    maxActionAmount == null
      ? t("earn.actions.balance.pending")
      : formatTokenAmount(maxActionAmount, decimals, availableUnit, 4);

  const handleUseMax = React.useCallback(() => {
    if (tab === "deposit" && walletBalance != null) setAmount(formatUnits(walletBalance, decimals));
    if (tab === "withdraw" && maxWithdraw != null) setAmount(formatUnits(maxWithdraw, decimals));
    if (tab === "redeem" && maxRedeem != null) setAmount(formatUnits(maxRedeem, decimals));
  }, [decimals, maxRedeem, maxWithdraw, tab, walletBalance]);

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

      const availableForTab =
        tab === "deposit" ? walletBalance : tab === "withdraw" ? maxWithdraw : maxRedeem;
      if (availableForTab != null && parsed > availableForTab) {
        toast.error(
          tab === "deposit"
            ? t("earn.errors.insufficientWalletBalance")
            : tab === "withdraw"
              ? t("earn.errors.exceedsWithdrawable")
              : t("earn.errors.exceedsRedeemable")
        );
        return;
      }

      const toastId = toast.loading(t("earn.toast.processing"));
      const account = sdk.account;
      const result =
        tab === "deposit"
          ? await depositFlow.execute(() => sdk.bank.deposit(poolId, parsed, account))
          : tab === "withdraw"
            ? await withdrawFlow.execute(() => sdk.bank.withdraw(poolId, parsed, account, account))
            : await redeemFlow.execute(() => sdk.bank.redeem(poolId, parsed, account, account));

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
        tab === "redeem"
          ? t("earn.toast.redeemed", { amount: formatUnits(parsed, decimals) })
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
    decimals,
    depositFlow,
    explorerBaseUrl,
    maxRedeem,
    maxWithdraw,
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
  const freeReserve = snapshot
    ? snapshot.totalAssets > snapshot.totalReserved
      ? snapshot.totalAssets - snapshot.totalReserved
      : 0n
    : undefined;

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
      label: t("earn.metrics.freeReserve.label"),
      value: formatTokenAmount(freeReserve, decimals, symbol, 2),
      detail: t("earn.metrics.freeReserve.detail")
    }
  ];

  return (
    <PageTransition pageKey="earn">
      <div className="space-y-8">
        <EarnHero symbol={symbol} bankAddress={shortHex(snapshot?.bank)} metrics={metrics} />
        {/* Provider diligence: how the house bankroll has actually performed
            (indexed, best-effort) — shown before the deposit console so a
            provider sees the evidence before they act. */}
        <BankrollPerformancePanel vaultAssets={snapshot?.totalAssets} />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
          <div className="space-y-6">
            <section className="rounded-md border border-border bg-surface-1 shadow-e2">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div className="grid grid-cols-2 gap-1 rounded-md border border-border-soft bg-surface-0 p-1">
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
                      className={`rounded-sm px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] transition ${
                        diligenceTab === item.key
                          ? "bg-brand text-fg-inverse"
                          : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                      }`}
                    >
                      {item.label}
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
          </div>
          <EarnActionPanel
            tab={tab}
            onTabChange={setTab}
            assets={assetOptions}
            asset={asset}
            onAssetChange={setAsset}
            amount={amount}
            onAmountChange={setAmount}
            symbol={symbol}
            disabled={
              readOnly || flow.busy || !sdk?.account || !amount || !writesSupportedForSelectedAsset
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
      </div>
    </PageTransition>
  );
}
