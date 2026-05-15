"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "@ssot/ssot/sdk";
import { ErrorCallout, toast, type TxStatus } from "@ssot/ui";

import { PageTransition } from "../../../components/PageTransition";
import { ProductStateCard } from "../../../components/ProductStateCard";
import { AccountContextCard } from "../../../features/portfolio/overview/account-context-card";
import { AccountHero } from "../../../features/portfolio/overview/account-hero";
import { AccountIdentityCard } from "../../../features/portfolio/overview/account-identity-card";
import { AccountJournal } from "../../../features/portfolio/overview/account-journal";
import { AccountPositionsPanel } from "../../../features/portfolio/overview/account-positions-panel";
import { AccountRefundCard } from "../../../features/portfolio/overview/account-refund-card";
import {
  formatAmount,
  getExplorerBaseUrl,
  shortHex
} from "../../../features/portfolio/overview/format";
import type {
  AccountAssetRow,
  AccountFlowState,
  AccountJournalRow,
  AccountMetric
} from "../../../features/portfolio/overview/types";
import { useTxJournal } from "../../../features/portfolio/overview/useTxJournal";
import { useDirectTxAction } from "../../../features/tx/useDirectTxAction";
import { useRelease } from "../../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../../ssot/sdk";

const ALIAS_STORAGE_KEY = "ssot.player_alias";

export function AccountPageClient() {
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
    queryFn: async (): Promise<AccountAssetRow[]> => {
      if (!release || !sdk || !account) return [];
      return Promise.all(
        release.pools.map(async (pool) => {
          const assetMeta = release.assets.find(
            (asset) => asset.address.toLowerCase() === pool.asset.toLowerCase()
          );
          const assetAddress = pool.asset as Address;
          const [walletBalance, allowance, position] = await Promise.all([
            sdk.bank.getAssetBalance(assetAddress, account),
            sdk.bank.getAllowance(pool.poolId, account),
            sdk.bank.getPosition(pool.poolId, account)
          ]);
          return {
            id: String(pool.poolId),
            symbol: pool.symbol || assetMeta?.symbol || "Asset",
            decimals: pool.decimals ?? assetMeta?.decimals ?? 18,
            asset: pool.asset as `0x${string}`,
            bank: pool.bank as `0x${string}`,
            walletBalance,
            shares: position.shares,
            assetsEquivalent: position.assetsEquivalent,
            allowance
          };
        })
      );
    },
    refetchInterval: 5_000
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
    refetchInterval: 5_000
  });

  const claimRefundFlow = useDirectTxAction({
    action: "CLAIM_VRF_REFUND",
    labels: {
      preflight: "Preflight",
      submit: "Submit claim",
      confirm: "Confirm on-chain"
    },
    descriptions: {
      preflight: "Validate refund credit.",
      submit: "Broadcast claimRefundCredit.",
      confirm: "Wait for receipt."
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
    toast.success("Player label saved locally.");
  }, [debouncedAlias, mounted]);

  const handleCopyAccount = React.useCallback(() => {
    if (!account) return;
    if (!navigator.clipboard?.writeText) {
      toast.error("Clipboard is unavailable in this browser.");
      return;
    }
    void navigator.clipboard
      .writeText(account)
      .then(() => toast.success("Wallet address copied"))
      .catch((error) => toast.error((error as Error)?.message ?? "Failed to copy wallet address"));
  }, [account]);

  const handleClaimRefund = React.useCallback(async () => {
    if (!sdk || !account || readOnly) return;
    try {
      const result = await claimRefundFlow.execute(() => sdk.vrfHub.claimRefundCredit());
      if (!result.ok) return;
      toast.success("Refund credit claimed");
      await refetchRefundCredit();
    } catch (error) {
      toast.error((error as Error).message ?? "Refund claim failed");
    }
  }, [account, claimRefundFlow, readOnly, refetchRefundCredit, sdk]);

  if (!release) {
    return (
      <ProductStateCard
        title="Account"
        description={readOnlyReason ?? "No embedded release available."}
      />
    );
  }

  const primaryAsset = release.assets[0];
  const totalAssetsEquivalent = assetRows.reduce((sum, row) => sum + row.assetsEquivalent, 0n);
  const totalWalletBalance = assetRows.reduce((sum, row) => sum + row.walletBalance, 0n);
  const refundAmount =
    account && primaryAsset
      ? formatAmount(refundCredit, primaryAsset.decimals, primaryAsset.symbol)
      : account
        ? "Pending"
        : "Wallet required";
  const metrics: AccountMetric[] = [
    {
      label: "Wallet balance",
      value:
        account && primaryAsset
          ? formatAmount(totalWalletBalance, primaryAsset.decimals, primaryAsset.symbol)
          : account
            ? "Pending"
            : "Wallet required",
      detail: "Free balance across the active release asset set."
    },
    {
      label: "Bank position",
      value:
        account && primaryAsset
          ? formatAmount(totalAssetsEquivalent, primaryAsset.decimals, primaryAsset.symbol)
          : account
            ? "Pending"
            : "Wallet required",
      detail: "Assets equivalent for connected Bank shares."
    },
    {
      label: "Refund credit",
      value: refundAmount,
      detail: "Recoverable VRF balance credited to the wallet."
    }
  ];

  const refundFlow = toFlowState(claimRefundFlow);
  const journalRows = txRows as AccountJournalRow[];

  return (
    <PageTransition pageKey="account">
      <div className="space-y-8">
        <AccountHero account={shortHex(account)} metrics={metrics} />

        {readOnly ? (
          <ErrorCallout
            title="Read-only session"
            message={readOnlyReason ?? "Writes are disabled."}
          />
        ) : null}
        {balancesError ? (
          <ErrorCallout title="Asset query failed" message={(balancesError as Error).message} />
        ) : null}
        {refundError ? (
          <ErrorCallout title="Refund query failed" message={(refundError as Error).message} />
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[360px_1fr_420px]">
          <div className="space-y-6">
            <AccountIdentityCard
              account={account}
              alias={alias}
              saved={debouncedAlias === alias}
              onAliasChange={setAlias}
              onCopyAccount={handleCopyAccount}
            />
            <AccountContextCard
              readOnly={readOnly}
              releaseName={release.name}
              releaseDigest={release.releaseDigest}
            />
            <Link
              href="/earn"
              className="block rounded-md border border-border bg-surface-1 p-5 text-sm font-black uppercase tracking-[0.12em] text-brand shadow-e2 transition hover:bg-surface-2 hover:text-brand-hover"
            >
              Open bank console
            </Link>
          </div>

          <div className="space-y-6">
            <AccountPositionsPanel rows={assetRows} loading={balancesLoading} />
            {!account ? (
              <div className="rounded-md border border-dashed border-border bg-surface-1 p-5 text-sm text-fg-muted">
                Connect a wallet to inspect account state.
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <AccountRefundCard
              amount={refundAmount}
              connected={Boolean(account)}
              readOnly={readOnly}
              disabled={!account || readOnly || refundFlow.busy || refundCredit === 0n}
              flow={refundFlow}
              explorerBaseUrl={explorerBaseUrl}
              onClaim={() => void handleClaimRefund()}
            />
            <AccountJournal rows={journalRows} explorerBaseUrl={explorerBaseUrl} />
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function toFlowState(flow: {
  status: TxStatus;
  steps: AccountFlowState["steps"];
  hasActivity: boolean;
  busy: boolean;
  error?: AccountFlowState["error"];
  txHash?: string;
  journalEntry?: { blockNumber?: number } | null;
  reset: () => void;
}): AccountFlowState {
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
