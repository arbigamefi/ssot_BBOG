"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Address } from "@ssot/ssot/sdk";

import { isLpDepositEnabledForChain } from "../../../app-shell/casino-access";
import { PageTransition } from "../../../components/PageTransition";
import { ProductStateCard } from "../../../components/ProductStateCard";
import { BankProviderLedgerPanel } from "../../../features/earn/BankProviderLedgerPanel";
import { BankrollPerformancePanel } from "../../../features/earn/BankrollPerformancePanel";
import {
  EarnActionPanel,
  EarnMobileActions,
  type EarnFlowState
} from "../../../features/earn/earn-action-panel";
import {
  EarnRedemptionPanel,
  EarnPlayerPayable,
  EarnDepositNotice,
  getEarnRedemptionView
} from "../../../features/earn/earn-redemption-panel";
import { EarnBankDetails } from "../../../features/earn/earn-bank-details";
import { EarnHero } from "../../../features/earn/earn-hero";
import { buildEarnHeroMetrics } from "../../../features/earn/earn-hero-metrics";
import { formatTokenAmount, getExplorerBaseUrl, shortHex } from "../../../features/earn/format";
import type { EarnAmountMode, EarnBankData, EarnTab } from "../../../features/earn/types";
import { useBankProviderLedger } from "../../../features/earn/useBankProviderLedger";
import { useBankRecovery } from "../../../features/earn/useBankRecovery";
import { EarnRecoveryPanel } from "../../../features/earn/earn-recovery-panel";
import { getPoolAssetContext, type PoolAssetContext } from "../../../features/assets/pool-asset";
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
  const chainDepositsEnabled = isLpDepositEnabledForChain(chainId);
  const { sdk, ready } = useSSOTSDK();
  const queryClient = useQueryClient();
  const explorerBaseUrl = React.useMemo(() => getExplorerBaseUrl(chainId), [chainId]);

  const poolContexts = React.useMemo(
    () =>
      release?.pools
        .filter((pool) => pool.domainId === 1 || pool.domain?.toLowerCase() === "casino")
        .map((pool) => getPoolAssetContext(release, pool))
        .filter((context): context is PoolAssetContext => Boolean(context?.bank)) ?? [],
    [release]
  );
  const selectionScope = `${chainId}:${release?.releaseDigest ?? ""}`;
  const [poolSelection, setPoolSelection] = React.useState<{ scope: string; key: string }>();
  const contextKey = (context: PoolAssetContext) => `${context.poolId}:${context.bank}`;
  const selectedContext =
    (poolSelection?.scope === selectionScope
      ? poolContexts.find((context) => contextKey(context) === poolSelection.key)
      : undefined) ??
    poolContexts[0] ??
    null;
  const poolId = selectedContext?.poolId;
  const poolKey = selectedContext ? contextKey(selectedContext) : "";
  const bankAddress = selectedContext?.bank;
  const depositsEnabled = chainDepositsEnabled && selectedContext?.pool.active === true;
  const writesSupportedForSelectedAsset = Boolean(
    selectedContext &&
    release?.pools
      .filter((pool) => pool.poolId === poolId)
      .every((pool) => pool.bank.toLowerCase() === bankAddress)
  );
  const asset = selectedContext?.asset.address ?? ZERO_ADDRESS;
  const decimals = selectedContext?.asset.decimals ?? 18;
  const symbol = selectedContext?.asset.symbol ?? t("earn.format.assetFallback");
  const showIndexedHistory =
    new Set(
      poolContexts
        .filter((context) => context.asset.address === asset)
        .map((context) => context.bank)
    ).size === 1;
  const poolOptions = poolContexts.map((context) => ({
    key: contextKey(context),
    label: t("earn.pools.option", {
      symbol: context.asset.symbol,
      poolId: context.poolId,
      bank: shortHex(context.bank)
    })
  }));

  const {
    data: bankData,
    isLoading,
    error: loadError
  } = useQuery({
    queryKey: [
      "ssot",
      "earn",
      "bank",
      chainId,
      poolId,
      bankAddress,
      release?.releaseDigest,
      sdk?.account ?? "anonymous"
    ],
    enabled: Boolean(sdk && ready && writesSupportedForSelectedAsset && poolId),
    queryFn: async (): Promise<EarnBankData> => {
      if (!sdk) throw new Error(t("earn.errors.sdkUnavailable"));
      if (!poolId || !writesSupportedForSelectedAsset)
        throw new Error(t("earn.errors.poolUnavailable"));
      const snapshot = await sdk.bank.getSnapshot(poolId);
      if (snapshot.bank?.toLowerCase() !== bankAddress) throw new Error(t("earn.async.unknown"));
      const position = sdk.account
        ? await sdk.bank.getPosition(poolId, sdk.account, {
            blockNumber: snapshot.updatedAtBlock
          })
        : null;
      return { snapshot, position };
    },
    // Keep the snapshot stable while the holder pages through historical rights.
    // Refresh controls and confirmed wallet actions invalidate this whole snapshot.
    staleTime: Infinity,
    refetchOnWindowFocus: false
  });

  const bankLoaded = Boolean(bankData && !loadError);
  const bankPaused = bankData?.snapshot.riskInPaused !== false;
  const redemptionState = loadError
    ? null
    : getEarnRedemptionView(bankData?.snapshot, bankData?.position);
  const [asyncBusy, setAsyncBusy] = React.useState(false);
  const [asyncAction, setAsyncAction] = React.useState("REQUEST_REDEEM");
  const asyncBusyRef = React.useRef(false);
  const asyncFlow = useDirectTxAction({
    action: asyncAction,
    errorMessage: t("app.errors.transactionFailed"),
    labels: {
      preflight: t("earn.flows.preflight.title"),
      submit: t("earn.flows.direct.submit"),
      confirm: t("earn.flows.direct.confirm")
    }
  });

  const [tab, setTab] = React.useState<EarnTab>(() => (depositsEnabled ? "deposit" : "withdraw"));
  const [amountMode, setAmountMode] = React.useState<EarnAmountMode>("assets");
  const [amount, setAmount] = React.useState("");
  const actionPanelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setAmount("");
  }, [tab, amountMode, asset, poolKey, selectionScope]);

  React.useEffect(() => {
    if (!depositsEnabled) setTab("withdraw");
  }, [depositsEnabled]);

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

  const currentFlow =
    tab === "withdraw" ? asyncFlow : amountMode === "shares" ? mintFlow : depositFlow;
  const flow: EarnFlowState = {
    status: currentFlow.status,
    steps: currentFlow.steps,
    hasActivity: currentFlow.hasActivity,
    busy: currentFlow.busy || asyncBusy,
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
    refetchInterval: currentFlow.busy ? false : 15_000
  });

  const { data: maxMintShares = null } = useQuery({
    queryKey: ["ssot", "earn", "maxMintShares", selectionScope, poolKey, walletBalance?.toString()],
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
    refetchInterval: currentFlow.busy ? false : 15_000
  });

  const providerLedger = useBankProviderLedger({
    enabled: Boolean(ready && poolId && writesSupportedForSelectedAsset),
    poolId,
    sdk,
    endBlock: bankData?.snapshot.updatedAtBlock
  });
  const recovery = useBankRecovery({
    sdk,
    poolId,
    blockNumber: bankData?.snapshot.updatedAtBlock,
    enabled: Boolean(bankLoaded && ready && writesSupportedForSelectedAsset)
  });

  const maxActionAmount = amountMode === "shares" ? maxMintShares : walletBalance;
  const availableUnit = amountMode === "shares" ? t("earn.units.sharesLower") : symbol;
  const availableLabel = t(
    amountMode === "shares" ? "earn.actions.balance.mintable" : "earn.actions.balance.wallet"
  );
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
  }, [amountMode, decimals, maxMintShares, tab, walletBalance]);

  const handleSubmit = React.useCallback(async () => {
    if (asyncBusyRef.current || !bankLoaded || bankPaused || tab !== "deposit") {
      toast.error(t(!bankLoaded ? "earn.async.unknown" : "earn.async.paused"));
      return;
    }
    if (tab === "deposit" && !depositsEnabled) {
      toast.error(t("earn.actions.depositsClosed.title"));
      return;
    }
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
      const freshWalletBalance = await sdk.bank.getAssetBalance(asset, account);
      const freshAvailable =
        amountMode === "shares"
          ? await sdk.bank.convertToShares(poolId, freshWalletBalance)
          : freshWalletBalance;
      if (parsed > freshAvailable) {
        toast.error(
          t(
            amountMode === "shares"
              ? "earn.errors.exceedsMintable"
              : "earn.errors.insufficientWalletBalance"
          )
        );
        return;
      }
      const toastId = toast.loading(t("earn.toast.processing"));
      const result =
        amountMode === "shares"
          ? await mintFlow.execute(() => sdk.bank.mint(poolId, parsed, account))
          : await depositFlow.execute(() => sdk.bank.deposit(poolId, parsed, account));

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
          ? t("earn.toast.minted", {
              amount: formatUnits(parsed, decimals)
            })
          : t("earn.toast.deposited", {
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
    bankLoaded,
    bankPaused,
    amount,
    amountMode,
    asset,
    decimals,
    depositFlow,
    depositsEnabled,
    explorerBaseUrl,
    mintFlow,
    queryClient,
    readOnly,
    sdk,
    symbol,
    tab,
    poolId,
    t,
    writesSupportedForSelectedAsset
  ]);

  const handleAsyncAction = async (
    action: "request" | "cancel" | "claim" | "player" | "recovery",
    shares?: bigint,
    epochId?: bigint
  ) => {
    if (
      !sdk?.account ||
      !poolId ||
      readOnly ||
      !writesSupportedForSelectedAsset ||
      !ready ||
      asyncBusyRef.current ||
      currentFlow.busy
    )
      return;
    asyncBusyRef.current = true;
    setAsyncBusy(true);
    let toastId: string | number | undefined;
    try {
      const account = sdk.account;
      const snapshot = await sdk.bank.getSnapshot(poolId);
      if (snapshot.bank?.toLowerCase() !== bankAddress) throw new Error(t("earn.async.unknown"));
      const position = await sdk.bank.getPosition(poolId, account, {
        blockNumber: snapshot.updatedAtBlock
      });
      const fresh = getEarnRedemptionView(snapshot, position);
      if (!fresh) throw new Error(t("earn.async.unknown"));
      if ((action === "claim" || action === "recovery") && fresh.paused)
        throw new Error(t("earn.async.paused"));
      if (action === "request" && (shares == null || shares <= 0n || shares > fresh.walletShares))
        throw new Error(t("earn.errors.exceedsRedeemable"));
      if (action === "cancel" && fresh.cancellableShares === 0n)
        throw new Error(t("earn.async.cancelDetail"));
      if (action === "claim" && fresh.claimableShares === 0n) return;
      if (action === "player" && (position.playerPayable ?? 0n) === 0n) return;
      if (action === "recovery") {
        if (epochId == null) return;
        const right = await sdk.bank.getRecovery(poolId, epochId, account, {
          blockNumber: snapshot.updatedAtBlock
        });
        if (right.updatedAtBlock !== snapshot.updatedAtBlock || right.epochId !== epochId)
          throw new Error(t("earn.recovery.error"));
        if (right.claimableAssets <= 0n) return;
      }
      toastId = toast.loading(t("earn.toast.processing"));
      setAsyncAction(
        action === "request"
          ? "REQUEST_REDEEM"
          : action === "cancel"
            ? "CANCEL_REDEEM"
            : action === "recovery"
              ? "CLAIM_RECOVERY"
              : action === "player"
                ? "CLAIM_PLAYER_PAYABLE"
                : "REDEEM"
      );
      const result = await asyncFlow.execute(() =>
        action === "request"
          ? sdk.bank.requestRedeem(poolId, shares!, account, account)
          : action === "cancel"
            ? sdk.bank.cancelRedeemRequest(poolId, account)
            : action === "recovery"
              ? sdk.bank.claimRecovery(poolId, epochId!, account, account)
              : action === "player"
                ? sdk.bank.claimPlayerPayable(poolId, account)
                : sdk.bank.redeem(poolId, fresh.claimableShares, account, account)
      );
      if (!result.ok) throw new Error(result.error?.message ?? t("earn.toast.failed"));
      toast.success(
        t(
          action === "request"
            ? "earn.async.requested"
            : action === "cancel"
              ? "earn.async.cancelled"
              : action === "recovery"
                ? "earn.recovery.claimed"
                : action === "player"
                  ? "earn.async.playerClaimed"
                  : "earn.async.claimed"
        ),
        { id: toastId }
      );
      toastId = undefined;
    } catch (error) {
      toast.error((error as Error)?.message ?? t("earn.toast.failed"));
    } finally {
      if (toastId != null) toast.dismiss(toastId);
      await queryClient.invalidateQueries({ queryKey: ["ssot", "earn"] });
      asyncBusyRef.current = false;
      setAsyncBusy(false);
    }
  };

  if (!release) {
    return (
      <ProductStateCard
        title={t("earn.state.noRelease.title")}
        description={readOnlyReason ?? t("earn.state.noRelease.description")}
      />
    );
  }

  const snapshot = bankData?.snapshot;
  const metrics = buildEarnHeroMetrics({ snapshot, decimals, symbol, t });

  return (
    <PageTransition pageKey="earn">
      <div className="space-y-8 pb-28 lg:pb-0">
        <EarnHero symbol={symbol} bankAddress={shortHex(snapshot?.bank)} metrics={metrics} />
        <BankrollPerformancePanel
          assetAddress={asset}
          assetDecimals={decimals}
          assetSymbol={symbol}
          chainPerformance={snapshot}
          showIndexedHistory={showIndexedHistory}
          sharePrice={snapshot?.assetsPerShare}
          vaultAssets={snapshot?.totalAssets}
        />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
          <EarnBankDetails
            data={bankData}
            decimals={decimals}
            symbol={symbol}
            loading={isLoading}
            error={loadError ? t("earn.async.unknown") : undefined}
            releaseDigest={release.releaseDigest}
          />
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
              pools={poolOptions}
              poolKey={poolKey}
              onPoolChange={(key) => {
                if (poolOptions.some((option) => option.key === key))
                  setPoolSelection({ scope: selectionScope, key });
              }}
              amount={amount}
              onAmountChange={setAmount}
              symbol={symbol}
              disabled={
                (tab === "deposit" && !depositsEnabled) ||
                !bankLoaded ||
                bankPaused ||
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
              depositsClosed={!depositsEnabled}
              notice={
                <EarnDepositNotice
                  loaded={bankLoaded}
                  inactive={selectedContext?.pool.active === false}
                  paused={bankPaused && tab === "deposit"}
                  busy={flow.busy}
                  onRefresh={() =>
                    void queryClient.invalidateQueries({ queryKey: ["ssot", "earn"] })
                  }
                />
              }
              withdrawContent={
                <EarnRedemptionPanel
                  key={`${selectionScope}:${poolKey}:${sdk?.account}`}
                  state={redemptionState}
                  connected={Boolean(sdk?.account)}
                  decimals={decimals}
                  symbol={symbol}
                  disabled={readOnly || !ready || !writesSupportedForSelectedAsset || !sdk?.account}
                  busy={flow.busy}
                  onRequest={(shares) => void handleAsyncAction("request", shares)}
                  onCancel={() => void handleAsyncAction("cancel")}
                  onClaim={() => void handleAsyncAction("claim")}
                  receiver={sdk?.account}
                />
              }
            />
            <EarnPlayerPayable
              amount={bankData?.position?.playerPayable ?? 0n}
              decimals={decimals}
              symbol={symbol}
              disabled={
                readOnly ||
                !ready ||
                flow.busy ||
                !writesSupportedForSelectedAsset ||
                !redemptionState
              }
              onClaim={() => void handleAsyncAction("player")}
            />
          </div>
          <div className="min-w-0 space-y-6 xl:col-start-1 xl:row-start-2">
            <EarnRecoveryPanel
              items={recovery.items}
              connected={Boolean(sdk?.account)}
              receiver={sdk?.account}
              snapshotBlock={bankData?.snapshot.updatedAtBlock}
              snapshotTime={bankData?.snapshot.snapshotTimestamp}
              complete={bankLoaded && recovery.complete}
              loading={recovery.isLoading}
              loadingMore={recovery.isFetchingNextPage}
              hasMore={Boolean(recovery.hasNextPage)}
              error={Boolean(recovery.error || loadError)}
              paused={bankPaused}
              disabled={
                readOnly ||
                !ready ||
                !bankLoaded ||
                !writesSupportedForSelectedAsset ||
                !sdk?.account
              }
              busy={flow.busy}
              decimals={decimals}
              symbol={symbol}
              onLoadMore={() => void recovery.fetchNextPage()}
              onRefresh={() => void queryClient.invalidateQueries({ queryKey: ["ssot", "earn"] })}
              onClaim={(epochId) => void handleAsyncAction("recovery", undefined, epochId)}
            />
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
              positionAssets={
                bankLoaded && bankData?.position
                  ? bankData.position.activeAndClaimableAssets + recovery.claimableAssets
                  : undefined
              }
              positionShares={bankData?.position?.shares}
              recoveryComplete={bankLoaded && recovery.complete}
              hasUnsettledRecovery={
                recovery.hasUnsettledRecovery ||
                (bankData?.position?.queuedRecoveryAssets ?? 0n) > 0n
              }
              cashFlowComplete={providerLedger.coverageComplete}
              symbol={symbol}
            />
          </div>
        </div>
      </div>
      <EarnMobileActions tab={tab} onTabChange={focusActionPanel} />
    </PageTransition>
  );
}
