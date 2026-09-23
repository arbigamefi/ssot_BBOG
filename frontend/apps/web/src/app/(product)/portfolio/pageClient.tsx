"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ErrorCallout, toast, type TxStatus } from "@ssot/ui";

import { PageTransition } from "../../../components/PageTransition";
import { ProductStateCard } from "../../../components/ProductStateCard";
import { PortfolioContextCard } from "../../../features/portfolio/overview/portfolio-context-card";
import { PortfolioHero } from "../../../features/portfolio/overview/portfolio-hero";
import { PortfolioIdentityCard } from "../../../features/portfolio/overview/portfolio-identity-card";
import { PortfolioJournal } from "../../../features/portfolio/overview/portfolio-journal";
import { PortfolioPositionsPanel } from "../../../features/portfolio/overview/portfolio-positions-panel";
import { PortfolioRefundCard } from "../../../features/portfolio/overview/portfolio-refund-card";
import {
  formatAmount,
  getExplorerBaseUrl,
  shortHex
} from "../../../features/portfolio/overview/format";
import type {
  PortfolioAssetRow,
  PortfolioFlowState,
  PortfolioJournalRow,
  PortfolioMetric
} from "../../../features/portfolio/overview/types";
import { getPoolAssetContext } from "../../../features/assets/pool-asset";
import { useTxJournal } from "../../../features/portfolio/overview/useTxJournal";
import { useDirectTxAction } from "../../../features/tx/useDirectTxAction";
import { useRelease } from "../../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../../ssot/sdk";

const ALIAS_STORAGE_KEY = "ssot.player_alias";

export function PortfolioPageClient() {
  const t = useTranslations();
  const { release, chainId, readOnly, readOnlyReason } = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const explorerBaseUrl = React.useMemo(() => getExplorerBaseUrl(chainId), [chainId]);
  const account = sdk?.account;

  const { data: txRows = [] } = useTxJournal(50);

  const {
    data: assetRows = [],
    isLoading: balancesLoading,
    error: balancesError
  } = useQuery({
    queryKey: ["ssot", "account", "assets", release?.releaseDigest, account],
    enabled: Boolean(release && ready && sdk && account),
    queryFn: async (): Promise<PortfolioAssetRow[]> => {
      if (!release || !sdk || !account) return [];
      const rows = await Promise.all(
        release.pools.map(async (pool) => {
          const poolAsset = getPoolAssetContext(release, pool);
          if (!poolAsset?.bank) return null;
          const assetAddress = poolAsset.asset.address;
          const [walletBalance, allowance, position] = await Promise.all([
            sdk.bank.getAssetBalance(assetAddress, account),
            sdk.bank.getAllowance(pool.poolId, account),
            sdk.bank.getPosition(pool.poolId, account)
          ]);
          return {
            id: String(pool.poolId),
            symbol: poolAsset.asset.symbol,
            decimals: poolAsset.asset.decimals,
            asset: poolAsset.asset.address,
            bank: poolAsset.bank,
            walletBalance,
            shares: position.shares,
            assetsEquivalent: position.assetsEquivalent,
            allowance
          };
        })
      );
      return rows.filter((row): row is PortfolioAssetRow => Boolean(row));
    },
    // Balances, allowances and LP positions only move when the viewer acts or a
    // round settles, and every action on this page refetches explicitly, so a
    // slow idle poll costs nothing perceptible and a fast one burns provider
    // quota for every open tab.
    refetchInterval: 15_000
  });

  const {
    data: refundCredit = 0n,
    error: refundError,
    refetch: refetchRefundCredit
  } = useQuery({
    queryKey: ["ssot", "account", "refundCredit", chainId, account],
    enabled: Boolean(ready && sdk && account),
    queryFn: async () => {
      if (!sdk || !account) return 0n;
      return sdk.vrfHub.getRefundCredit(account);
    },
    // Claiming refetches this immediately (refetchRefundCredit below).
    refetchInterval: 15_000
  });

  const claimRefundFlow = useDirectTxAction({
    action: "CLAIM_VRF_REFUND",
    errorMessage: t("app.errors.transactionFailed"),
    labels: {
      preflight: t("portfolio.overview.refund.flow.preflight"),
      submit: t("portfolio.overview.refund.flow.submit"),
      confirm: t("portfolio.overview.refund.flow.confirm")
    },
    descriptions: {
      preflight: t("portfolio.overview.refund.flow.preflightDetail"),
      submit: t("portfolio.overview.refund.flow.submitDetail"),
      confirm: t("portfolio.overview.refund.flow.confirmDetail")
    }
  });

  const [alias, setAlias] = React.useState("");
  const [debouncedAlias, setDebouncedAlias] = React.useState("");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(ALIAS_STORAGE_KEY) ?? "";
    setAlias(saved);
    setDebouncedAlias(saved);
  }, []);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedAlias(alias), 600);
    return () => window.clearTimeout(timeout);
  }, [alias]);

  React.useEffect(() => {
    if (!mounted) return;
    const current = localStorage.getItem(ALIAS_STORAGE_KEY) ?? "";
    if (debouncedAlias === current) return;
    localStorage.setItem(ALIAS_STORAGE_KEY, debouncedAlias);
    toast.success(t("portfolio.overview.toast.labelSaved"));
  }, [debouncedAlias, mounted, t]);

  const handleCopyAccount = React.useCallback(() => {
    if (!account) return;
    if (!navigator.clipboard?.writeText) {
      toast.error(t("portfolio.overview.toast.clipboardUnavailable"));
      return;
    }
    void navigator.clipboard
      .writeText(account)
      .then(() => toast.success(t("portfolio.overview.toast.walletCopied")))
      .catch((error) =>
        toast.error((error as Error)?.message ?? t("portfolio.overview.toast.walletCopyFailed"))
      );
  }, [account, t]);

  const handleClaimRefund = React.useCallback(async () => {
    if (!sdk || !account || readOnly) return;
    try {
      const result = await claimRefundFlow.execute(() => sdk.vrfHub.claimRefundCredit());
      if (!result.ok) return;
      toast.success(t("portfolio.overview.toast.refundClaimed"));
      await refetchRefundCredit();
    } catch (error) {
      toast.error((error as Error).message ?? t("portfolio.overview.toast.refundClaimFailed"));
    }
  }, [account, claimRefundFlow, readOnly, refetchRefundCredit, sdk, t]);

  if (!release) {
    return (
      <ProductStateCard
        title={t("portfolio.overview.state.noRelease.title")}
        description={readOnlyReason ?? t("portfolio.overview.state.noRelease.description")}
      />
    );
  }

  const pendingLabel = t("portfolio.overview.common.pending");
  // Disconnected, every one of these slots used to spell out "wallet required".
  // Together with the hero label that put the same sentence on screen five
  // times, and it read as five separate faults rather than one thing to do --
  // in a monospace numeric slot, no less, where the eye expects a figure. The
  // hero states it once, next to the button that fixes it; the value slots just
  // stay empty.
  const valueUnavailable = t("portfolio.overview.common.valueUnavailable");
  const refundAmount = account
    ? formatAmount(refundCredit, 18, "ETH", pendingLabel)
    : valueUnavailable;
  const metrics: PortfolioMetric[] = [
    {
      label: t("portfolio.overview.metrics.walletBalance.label"),
      value: account
        ? formatPortfolioAssetAmounts(assetRows, "walletBalance", pendingLabel)
        : valueUnavailable,
      detail: t("portfolio.overview.metrics.walletBalance.detail")
    },
    {
      label: t("portfolio.overview.metrics.bankPosition.label"),
      value: account
        ? formatPortfolioAssetAmounts(assetRows, "assetsEquivalent", pendingLabel)
        : valueUnavailable,
      detail: t("portfolio.overview.metrics.bankPosition.detail")
    },
    {
      label: t("portfolio.overview.metrics.refundCredit.label"),
      value: refundAmount,
      detail: t("portfolio.overview.metrics.refundCredit.detail")
    }
  ];

  const refundFlow = toFlowState(claimRefundFlow);
  const journalRows = txRows as PortfolioJournalRow[];

  return (
    <PageTransition pageKey="portfolio">
      <div className="space-y-8">
        <PortfolioHero
          account={shortHex(account, pendingLabel)}
          connected={Boolean(account)}
          metrics={metrics}
        />

        {readOnly ? (
          <ErrorCallout
            title={t("portfolio.overview.alerts.readOnly.title")}
            message={readOnlyReason ?? t("portfolio.overview.alerts.readOnly.message")}
          />
        ) : null}
        {balancesError ? (
          <ErrorCallout
            title={t("portfolio.overview.alerts.assetQueryFailed")}
            message={(balancesError as Error).message}
          />
        ) : null}
        {refundError ? (
          <ErrorCallout
            title={t("portfolio.overview.alerts.refundQueryFailed")}
            message={(refundError as Error).message}
          />
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[360px_1fr_420px]">
          <div className="space-y-6">
            <PortfolioIdentityCard
              account={account}
              alias={alias}
              saved={debouncedAlias === alias}
              onAliasChange={setAlias}
              onCopyAccount={handleCopyAccount}
            />
            <PortfolioContextCard
              connected={Boolean(account)}
              readOnly={readOnly}
              releaseName={release.name}
            />
            <Link
              href="/earn"
              className="block rounded-md border border-border bg-surface-1 p-5 text-sm font-black uppercase tracking-[0.12em] text-brand shadow-e2 transition hover:bg-surface-2 hover:text-brand-hover"
            >
              {t("portfolio.overview.links.openBankConsole")}
            </Link>
          </div>

          <div className="space-y-6">
            <PortfolioPositionsPanel rows={assetRows} loading={balancesLoading} />
            {!account ? (
              <div className="rounded-md border border-dashed border-border bg-surface-1 p-5 text-sm text-fg-muted">
                {t("portfolio.overview.common.connectWalletInspect")}
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <PortfolioRefundCard
              amount={refundAmount}
              connected={Boolean(account)}
              readOnly={readOnly}
              disabled={!account || readOnly || refundFlow.busy || refundCredit === 0n}
              flow={refundFlow}
              explorerBaseUrl={explorerBaseUrl}
              onClaim={() => void handleClaimRefund()}
            />
            <PortfolioJournal rows={journalRows} explorerBaseUrl={explorerBaseUrl} />
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function formatPortfolioAssetAmounts(
  rows: readonly PortfolioAssetRow[],
  key: "walletBalance" | "assetsEquivalent",
  pendingLabel: string
) {
  if (rows.length === 0) return pendingLabel;
  return rows
    .map((row) => formatAmount(row[key], row.decimals, row.symbol, pendingLabel))
    .join(" / ");
}

function toFlowState(flow: {
  status: TxStatus;
  steps: PortfolioFlowState["steps"];
  hasActivity: boolean;
  busy: boolean;
  error?: PortfolioFlowState["error"];
  txHash?: string;
  journalEntry?: { blockNumber?: number } | null;
  reset: () => void;
}): PortfolioFlowState {
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
