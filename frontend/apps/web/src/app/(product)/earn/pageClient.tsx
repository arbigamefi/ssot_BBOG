"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "@ssot/ssot/sdk";
import type { AssetOption } from "@ssot/ui";

import { PageTransition } from "../../../components/PageTransition";
import { ProductStateCard } from "../../../components/ProductStateCard";
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
  const symbol = assetMeta?.symbol ?? "Asset";

  const {
    data: bankData,
    isLoading,
    error: loadError,
    refetch
  } = useQuery({
    queryKey: ["ssot", "earn", "bank", chainId, poolId, sdk?.account ?? "anonymous"],
    enabled: Boolean(sdk && ready && assetMeta && poolId),
    queryFn: async (): Promise<EarnBankData> => {
      if (!sdk) throw new Error("SDK unavailable");
      if (!poolId) throw new Error("Pool unavailable");
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
    steps: [
      { key: "preflight", title: "Preflight", description: "Validate inputs and simulate flow." },
      {
        key: "approve",
        title: "Approve Bank",
        description: "Set ERC20 allowance.",
        action: "APPROVE_DEPOSIT",
        optional: true
      },
      {
        key: "deposit",
        title: "Deposit Assets",
        description: "Broadcast Bank.deposit.",
        action: "DEPOSIT"
      }
    ]
  });

  const withdrawFlow = useDirectTxAction({
    action: "WITHDRAW",
    labels: { preflight: "Preflight", submit: "Submit", confirm: "Confirm" },
    descriptions: {
      preflight: "Validate constraints.",
      submit: "Broadcast Bank.withdraw.",
      confirm: "Wait for receipt."
    }
  });

  const redeemFlow = useDirectTxAction({
    action: "REDEEM",
    labels: { preflight: "Preflight", submit: "Submit", confirm: "Confirm" },
    descriptions: {
      preflight: "Validate constraints.",
      submit: "Broadcast Bank.redeem.",
      confirm: "Wait for receipt."
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
      ? "Wallet balance"
      : maxActionAmount == null
        ? "Max pending"
        : `Max ${formatTokenAmount(maxActionAmount, decimals, tab === "redeem" ? "shares" : symbol, 2)}`;

  const handleUseMax = React.useCallback(() => {
    if (tab === "withdraw" && maxWithdraw != null) setAmount(formatUnits(maxWithdraw, decimals));
    if (tab === "redeem" && maxRedeem != null) setAmount(formatUnits(maxRedeem, decimals));
  }, [decimals, maxRedeem, maxWithdraw, tab]);

  const handleSubmit = React.useCallback(async () => {
    if (!sdk?.account || readOnly) return;
    setFormError(undefined);

    if (!writesSupportedForSelectedAsset || !poolId) {
      setFormError("Write flows require an active casino pool for the selected asset.");
      return;
    }

    try {
      const parsed = parseDecimalToUnits(amount, decimals);
      if (parsed <= 0n) {
        setFormError("Amount must be positive.");
        return;
      }

      const toastId = toast.loading("Processing bank transaction...");
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
          ? `Redeemed ${formatUnits(parsed, decimals)} shares`
          : `${tab === "deposit" ? "Deposited" : "Withdrew"} ${formatUnits(parsed, decimals)} ${symbol}`,
        { id: toastId }
      );
      setAmount("");
      await refetch();
    } catch (error) {
      toast.error((error as Error)?.message ?? "Transaction failed");
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
    writesSupportedForSelectedAsset
  ]);

  if (!release) {
    return (
      <ProductStateCard
        title="Earn"
        description={readOnlyReason ?? "No embedded release available."}
      />
    );
  }

  const snapshot = bankData?.snapshot;
  const freeReserve =
    snapshot && snapshot.totalAssets > snapshot.totalReserved
      ? snapshot.totalAssets - snapshot.totalReserved
      : undefined;

  const metrics: EarnMetric[] = [
    {
      label: "Free reserve",
      value: formatTokenAmount(freeReserve, decimals, symbol, 2),
      detail: "Assets not reserved for open liabilities."
    },
    {
      label: "Total assets",
      value: formatTokenAmount(snapshot?.totalAssets, decimals, symbol, 2),
      detail: "Current bank assets from protocol read."
    },
    {
      label: "Min liquidity",
      value: formatBps(snapshot?.minLiquidityBps),
      detail: "Configured floor before withdrawals."
    }
  ];

  return (
    <PageTransition pageKey="earn">
      <div className="space-y-8">
        <EarnHero symbol={symbol} bankAddress={shortHex(snapshot?.bank)} metrics={metrics} />
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
