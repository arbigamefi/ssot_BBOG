"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "@ssot/ssot/sdk";
import { AssetSelector, toast, type TxStatus } from "@ssot/ui";

import { PageTransition } from "../../../../components/PageTransition";
import { ProductStateCard } from "../../../../components/ProductStateCard";
import { ClaimsActionPanel } from "../../../../features/portfolio/claims/claims-action-panel";
import { ClaimsBuckets } from "../../../../features/portfolio/claims/claims-buckets";
import { ClaimsHero } from "../../../../features/portfolio/claims/claims-hero";
import {
  ClaimsJournal,
  type ClaimsJournalRow
} from "../../../../features/portfolio/claims/claims-journal";
import {
  formatTokenAmount,
  getExplorerBaseUrl,
  shortHex
} from "../../../../features/portfolio/claims/format";
import type {
  ClaimsAction,
  ClaimsFlowState,
  ClaimsMetric
} from "../../../../features/portfolio/claims/types";
import { TokenLogo } from "../../../../components/TokenLogo";
import { useCasinoPoolAssetSelection } from "../../../../features/assets/useCasinoPoolAssetSelection";
import { formatUnits, parseDecimalToUnits } from "../../../../features/betting/model/units";
import { useDirectTxAction } from "../../../../features/tx/useDirectTxAction";
import { useRelease } from "../../../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../../../ssot/sdk";

export function ClaimsPageClient() {
  const t = useTranslations();
  const { release, readOnly, readOnlyReason, chainId } = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const explorerBaseUrl = React.useMemo(() => getExplorerBaseUrl(chainId), [chainId]);
  const assetSelection = useCasinoPoolAssetSelection();
  const { assetOptions, selectedAsset, selectedContext, setSelectedAsset } = assetSelection;
  const asset = selectedContext?.asset.address as Address | undefined;
  const poolId = selectedContext?.poolId;
  const decimals = selectedContext?.asset.decimals ?? 18;
  const symbol = selectedContext?.asset.symbol ?? "XP";

  const xpClaimFlow = useDirectTxAction({
    action: "CLAIM_XP_ACCRUED",
    errorMessage: t("app.errors.transactionFailed"),
    labels: {
      preflight: t("portfolio.claims.flows.preflight"),
      submit: t("portfolio.claims.flows.submitClaim"),
      confirm: t("portfolio.claims.flows.confirm")
    },
    descriptions: {
      preflight: t("portfolio.claims.flows.claim.preflight"),
      submit: t("portfolio.claims.flows.claim.submit"),
      confirm: t("portfolio.claims.flows.receipt")
    }
  });

  const syncHoldbackFlow = useDirectTxAction({
    action: "SYNC_XP_HOLDBACK",
    errorMessage: t("app.errors.transactionFailed"),
    labels: {
      preflight: t("portfolio.claims.flows.preflight"),
      submit: t("portfolio.claims.flows.submitSync"),
      confirm: t("portfolio.claims.flows.confirm")
    },
    descriptions: {
      preflight: t("portfolio.claims.flows.sync.preflight"),
      submit: t("portfolio.claims.flows.sync.submit"),
      confirm: t("portfolio.claims.flows.receipt")
    }
  });

  const protocolFeeFlow = useDirectTxAction({
    action: "CLAIM_PROTOCOL_FEES",
    errorMessage: t("app.errors.transactionFailed"),
    labels: {
      preflight: t("portfolio.claims.flows.preflight"),
      submit: t("portfolio.claims.flows.submitClaim"),
      confirm: t("portfolio.claims.flows.confirm")
    },
    descriptions: {
      preflight: t("portfolio.claims.flows.fees.preflight"),
      submit: t("portfolio.claims.flows.fees.submit"),
      confirm: t("portfolio.claims.flows.receipt")
    }
  });

  const {
    data: xpBuckets,
    isLoading: xpLoading,
    error: xpError,
    refetch: refetchXP
  } = useQuery({
    queryKey: ["ssot", "claims", "xp", chainId, poolId, sdk?.account ?? "anonymous"],
    enabled: Boolean(sdk?.account && ready && poolId),
    queryFn: async () => {
      if (!sdk?.account) throw new Error(t("portfolio.claims.errors.walletUnavailable"));
      if (!poolId) throw new Error(t("portfolio.claims.errors.poolUnavailable"));
      return sdk.bank.getXPBuckets(poolId, sdk.account);
    },
    // Four reads per poll. Claiming and holdback sync both call refetchXP, so
    // the interval only has to cover awards arriving from other players' bets.
    refetchInterval: 20_000
  });

  const { data: snapshot, refetch: refetchSnapshot } = useQuery({
    queryKey: ["ssot", "claims", "bank", chainId, poolId],
    enabled: Boolean(sdk && ready && asset && poolId),
    queryFn: async () => {
      if (!sdk || !asset) throw new Error(t("portfolio.claims.errors.bankUnavailable"));
      if (!poolId) throw new Error(t("portfolio.claims.errors.poolUnavailable"));
      return sdk.bank.getSnapshot(poolId);
    },
    // Claiming protocol fees calls refetchSnapshot directly.
    refetchInterval: 20_000
  });

  const [activeAction, setActiveAction] = React.useState<ClaimsAction>("claim");
  const [xpClaimAmount, setXPClaimAmount] = React.useState("");
  const [feeAmount, setFeeAmount] = React.useState("");

  const handleClaimXP = React.useCallback(async () => {
    if (!sdk?.account || readOnly) return;
    try {
      const parsed = parseDecimalToUnits(xpClaimAmount || "0", decimals);
      if (parsed <= 0n) {
        toast.error(t("portfolio.claims.errors.positiveAmount"));
        return;
      }
      if (!poolId) throw new Error(t("portfolio.claims.errors.poolUnavailable"));
      const result = await xpClaimFlow.execute(() =>
        sdk.bank.claimXPAccrued(poolId, parsed, sdk.account!)
      );
      if (!result.ok) return;
      toast.success(
        t("portfolio.claims.toast.claimedXP", { amount: formatUnits(parsed, decimals), symbol })
      );
      setXPClaimAmount("");
      await refetchXP();
    } catch (error) {
      toast.error((error as Error)?.message ?? t("portfolio.claims.toast.xpClaimFailed"));
    }
  }, [decimals, poolId, readOnly, refetchXP, sdk, symbol, t, xpClaimAmount, xpClaimFlow]);

  const handleSyncHoldback = React.useCallback(async () => {
    if (!sdk?.account || readOnly) return;
    try {
      if (!poolId) throw new Error(t("portfolio.claims.errors.poolUnavailable"));
      const result = await syncHoldbackFlow.execute(() =>
        sdk.bank.syncXPHoldback(poolId, sdk.account!)
      );
      if (!result.ok) return;
      toast.success(t("portfolio.claims.toast.holdbackSynced"));
      await refetchXP();
    } catch (error) {
      toast.error((error as Error)?.message ?? t("portfolio.claims.toast.syncHoldbackFailed"));
    }
  }, [poolId, readOnly, refetchXP, sdk, syncHoldbackFlow, t]);

  const handleClaimFees = React.useCallback(async () => {
    if (!sdk?.account || readOnly) return;
    try {
      const parsed = parseDecimalToUnits(feeAmount || "0", decimals);
      if (parsed <= 0n) {
        toast.error(t("portfolio.claims.errors.positiveAmount"));
        return;
      }
      if (!poolId) throw new Error(t("portfolio.claims.errors.poolUnavailable"));
      const result = await protocolFeeFlow.execute(() =>
        sdk.bank.claimProtocolFees(poolId, parsed, sdk.account!)
      );
      if (!result.ok) return;
      toast.success(
        t("portfolio.claims.toast.claimedFees", {
          amount: formatUnits(parsed, decimals),
          symbol
        })
      );
      setFeeAmount("");
      await refetchSnapshot();
    } catch (error) {
      toast.error((error as Error)?.message ?? t("portfolio.claims.toast.protocolFeeFailed"));
    }
  }, [decimals, feeAmount, poolId, protocolFeeFlow, readOnly, refetchSnapshot, sdk, symbol, t]);

  if (!release) {
    return (
      <ProductStateCard
        title={t("portfolio.claims.state.noRelease.title")}
        description={readOnlyReason ?? t("portfolio.claims.state.noRelease.description")}
      />
    );
  }

  const pendingLabel = t("portfolio.claims.common.pending");
  const metrics: ClaimsMetric[] = [
    {
      label: t("portfolio.claims.metrics.accrued.label"),
      value: formatTokenAmount(xpBuckets?.accrued, decimals, symbol, 2, pendingLabel),
      detail: t("portfolio.claims.metrics.accrued.detail")
    },
    {
      label: t("portfolio.claims.metrics.holdback.label"),
      value: formatTokenAmount(xpBuckets?.holdback, decimals, symbol, 2, pendingLabel),
      detail: t("portfolio.claims.metrics.holdback.detail")
    },
    {
      label: t("portfolio.claims.metrics.protocolFees.label"),
      value: formatTokenAmount(snapshot?.protocolFeesPayable, decimals, symbol, 2, pendingLabel),
      detail: t("portfolio.claims.metrics.protocolFees.detail")
    }
  ];

  const activeFlow =
    activeAction === "claim"
      ? toFlowState(xpClaimFlow)
      : activeAction === "sync"
        ? toFlowState(syncHoldbackFlow)
        : toFlowState(protocolFeeFlow);

  const journalRows: ClaimsJournalRow[] = [
    ...toJournalRows({
      action: t("portfolio.claims.journal.actions.claimXP"),
      amount: `${xpClaimAmount || formatTokenAmount(xpBuckets?.accrued, decimals, symbol, 2, pendingLabel)}`,
      flow: toFlowState(xpClaimFlow)
    }),
    ...toJournalRows({
      action: t("portfolio.claims.journal.actions.syncHoldback"),
      amount: formatTokenAmount(xpBuckets?.holdback, decimals, symbol, 2, pendingLabel),
      flow: toFlowState(syncHoldbackFlow)
    }),
    ...toJournalRows({
      action: t("portfolio.claims.journal.actions.claimFees"),
      amount: `${feeAmount || formatTokenAmount(snapshot?.protocolFeesPayable, decimals, symbol, 2, pendingLabel)}`,
      flow: toFlowState(protocolFeeFlow)
    })
  ];

  return (
    <PageTransition pageKey="claims">
      <div className="space-y-8">
        <ClaimsHero
          wallet={sdk?.account ? shortHex(sdk.account, pendingLabel) : undefined}
          metrics={metrics}
        />
        {assetOptions.length > 0 ? (
          <section className="grid gap-3 rounded-lg border border-border-soft bg-surface-1 p-4 shadow-e1 md:grid-cols-[minmax(0,22rem)_1fr] md:items-center">
            <div className="min-w-0">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-fg-subtle">
                {t("earn.actions.asset")}
              </div>
              <AssetSelector
                variant="inline"
                assets={assetOptions}
                value={selectedAsset}
                onValueChange={setSelectedAsset}
                title={t("earn.actions.asset")}
                renderLogo={(option) => <TokenLogo symbol={option.symbol} size={20} />}
                className="max-w-full"
              />
            </div>
            <div className="min-w-0 rounded-md border border-border-soft bg-surface-0 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-fg-subtle">
                {t("earn.actions.asset")}
              </div>
              <div className="mt-1 truncate font-mono text-sm font-bold text-fg">
                #{poolId ?? "—"} · {symbol}
              </div>
            </div>
          </section>
        ) : null}
        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            <ClaimsBuckets
              data={{ buckets: xpBuckets, snapshot }}
              decimals={decimals}
              symbol={symbol}
              loading={xpLoading}
              error={(xpError as Error | undefined)?.message}
            />
            <ClaimsJournal rows={journalRows} explorerBaseUrl={explorerBaseUrl} />
          </div>
          <ClaimsActionPanel
            action={activeAction}
            onActionChange={setActiveAction}
            xpAmount={xpClaimAmount}
            onXPAmountChange={setXPClaimAmount}
            feeAmount={feeAmount}
            onFeeAmountChange={setFeeAmount}
            symbol={symbol}
            decimals={decimals}
            claimable={xpBuckets?.accrued}
            feeClaimable={snapshot?.protocolFeesPayable}
            holdback={xpBuckets?.holdback}
            connected={Boolean(sdk?.account)}
            readOnly={readOnly}
            flow={activeFlow}
            explorerBaseUrl={explorerBaseUrl}
            onClaimXP={() => void handleClaimXP()}
            onSyncHoldback={() => void handleSyncHoldback()}
            onClaimFees={() => void handleClaimFees()}
          />
        </div>
      </div>
    </PageTransition>
  );
}

function toFlowState(flow: {
  status: TxStatus;
  steps: ClaimsFlowState["steps"];
  hasActivity: boolean;
  busy: boolean;
  error?: ClaimsFlowState["error"];
  txHash?: string;
  journalEntry?: { blockNumber?: number } | null;
  reset: () => void;
}): ClaimsFlowState {
  return {
    status: flow.status,
    steps: flow.steps,
    hasActivity: flow.hasActivity,
    busy: flow.busy,
    error: flow.error,
    txHash: flow.txHash,
    blockNumber: flow.journalEntry?.blockNumber,
    reset: flow.reset
  };
}

function toJournalRows({
  action,
  amount,
  flow
}: {
  action: string;
  amount: string;
  flow: ClaimsFlowState;
}): ClaimsJournalRow[] {
  if (!flow.txHash) return [];
  return [
    {
      key: flow.txHash,
      action,
      amount,
      status: flow.status,
      txHash: flow.txHash
    }
  ];
}
