"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "@ssot/ssot/sdk";
import type { AssetOption } from "@ssot/ui";

import { PageTransition } from "../../../components/PageTransition";
import { ProductStateCard } from "../../../components/ProductStateCard";
import { BankrollPerformancePanel } from "../../../features/earn/BankrollPerformancePanel";
import { EarnActionPanel, type EarnFlowState } from "../../../features/earn/earn-action-panel";
import { EarnBankSummary } from "../../../features/earn/earn-bank-summary";
import { EarnHero } from "../../../features/earn/earn-hero";
import { EarnRiskPanel } from "../../../features/earn/earn-risk-panel";
import {
  formatBps,
  formatTokenAmount,
  getExplorerBaseUrl,
  shortHex
} from "../../../features/earn/format";
import type { EarnBankData, EarnMetric, EarnTab } from "../../../features/earn/types";
import { formatUnits, parseDecimalToUnits } from "../../../features/betting/model/units";
import { useDirectTxAction, useSequencedTxAction } from "../../../features/tx/useDirectTxAction";
import { useRelease } from "../../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../../ssot/sdk";
import { toast } from "@ssot/ui";

const ZERO_ADDRESS = `0x${"0".repeat(40)}` as Address;

export function EarnPageClient() {
  const t = useTranslations();
  const { release, readOnly, readOnlyReason, chainId } = useRelease();
  const { sdk, ready } = useSSOTSDK();
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
    error: loadError,
    refetch
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
  const [amount, setAmount] = React.useState("");
  const [formError, setFormError] = React.useState<string | undefined>();

  React.useEffect(() => {
    setAmount("");
    setFormError(undefined);
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
    }
  });

  const { data: maxRedeem = null } = useQuery({
    queryKey: ["ssot", "earn", "maxRedeem", chainId, poolId, sdk?.account],
    enabled: Boolean(sdk?.account && tab === "redeem" && writesSupportedForSelectedAsset),
    queryFn: async () => {
      if (!sdk?.account || !poolId) return null;
      return sdk.bank.maxRedeem(poolId, sdk.account);
    }
  });

  const maxActionAmount = tab === "withdraw" ? maxWithdraw : tab === "redeem" ? maxRedeem : null;
  const maxLabel =
    tab === "deposit"
      ? t("earn.actions.max.walletBalance")
      : maxActionAmount == null
        ? t("earn.actions.max.pending")
        : t("earn.actions.max.value", {
            amount: formatTokenAmount(
              maxActionAmount,
              decimals,
              tab === "redeem" ? t("earn.units.sharesLower") : symbol,
              2
            )
          });

  const handleUseMax = React.useCallback(() => {
    if (tab === "withdraw" && maxWithdraw != null) setAmount(formatUnits(maxWithdraw, decimals));
    if (tab === "redeem" && maxRedeem != null) setAmount(formatUnits(maxRedeem, decimals));
  }, [decimals, maxRedeem, maxWithdraw, tab]);

  const handleSubmit = React.useCallback(async () => {
    if (!sdk?.account || readOnly) return;
    setFormError(undefined);

    if (!writesSupportedForSelectedAsset || !poolId) {
      setFormError(t("earn.errors.unsupportedWriteAsset"));
      return;
    }

    try {
      const parsed = parseDecimalToUnits(amount, decimals);
      if (parsed <= 0n) {
        setFormError(t("earn.errors.positiveAmount"));
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
        return;
      }

      toast.success(
        tab === "redeem"
          ? t("earn.toast.redeemed", { amount: formatUnits(parsed, decimals) })
          : t(tab === "deposit" ? "earn.toast.deposited" : "earn.toast.withdrew", {
              amount: formatUnits(parsed, decimals),
              symbol
            }),
        { id: toastId }
      );
      setAmount("");
      await refetch();
    } catch (error) {
      toast.error((error as Error)?.message ?? t("earn.toast.failed"));
    }
  }, [
    amount,
    decimals,
    depositFlow,
    readOnly,
    redeemFlow,
    refetch,
    sdk,
    symbol,
    tab,
    withdrawFlow,
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
      label: t("earn.metrics.freeReserve.label"),
      value: formatTokenAmount(freeReserve, decimals, symbol, 2),
      detail: t("earn.metrics.freeReserve.detail")
    },
    {
      label: t("earn.metrics.totalAssets.label"),
      value: formatTokenAmount(snapshot?.totalAssets, decimals, symbol, 2),
      detail: t("earn.metrics.totalAssets.detail")
    },
    {
      label: t("earn.metrics.minLiquidity.label"),
      value: formatBps(snapshot?.minLiquidityBps),
      detail: t("earn.metrics.minLiquidity.detail")
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
        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            <EarnBankSummary
              data={bankData}
              decimals={decimals}
              symbol={symbol}
              loading={isLoading}
              error={(loadError as Error | undefined)?.message}
            />
            <EarnRiskPanel
              data={bankData}
              decimals={decimals}
              symbol={symbol}
              releaseDigest={release.releaseDigest}
            />
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
            formError={formError}
            maxLabel={maxLabel}
            onUseMax={handleUseMax}
            flow={flow}
            explorerBaseUrl={explorerBaseUrl}
            onSubmit={() => void handleSubmit()}
            connected={Boolean(sdk?.account)}
          />
        </div>
      </div>
    </PageTransition>
  );
}
