"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { DomainError } from "@ssot/ssot";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CopyButton,
  DataTable,
  ErrorCallout,
  PageHeader,
  StatCard,
  TxStatusChip,
  TxStepper,
  type DataTableColumn,
  toast,
} from "@ssot/ui";

import { ConnectWalletPrompt } from "../../components/ConnectWalletPrompt";
import { PageTransition } from "../../components/PageTransition";
import { useTxJournal } from "../../features/account/useTxJournal";
import { useDirectTxAction } from "../../features/tx/useDirectTxAction";
import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../ssot/sdk";
import { formatUnits } from "../../features/betting/model/units";

type AssetAuditRow = {
  id: string;
  symbol: string;
  decimals: number;
  asset: `0x${string}`;
  bank: `0x${string}`;
  walletBalance: bigint;
  shares: bigint;
  assetsEquivalent: bigint;
  allowance: bigint;
};

type JournalRow = {
  id: string;
  createdAt: number;
  action: string;
  status: string;
  txHash?: string;
  blockNumber?: number;
  errorCode?: string;
  releaseDigest: string;
  chainId: number;
};

const STATUS_COLORS: Record<string, string> = {
  mined: "text-emerald-400",
  submitted: "text-blue-400",
  failed: "text-rose-400",
  timeout: "text-amber-400",
};

function shortHex(s?: string) {
  if (!s) return "—";
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function formatAmount(value: bigint, decimals: number, symbol?: string) {
  const body = formatUnits(value, decimals);
  return symbol ? `${body} ${symbol}` : body;
}

function getExplorerBaseUrl(chainId: number) {
  switch (chainId) {
    case 84532:
      return "https://sepolia.basescan.org";
    case 8453:
      return "https://basescan.org";
    case 42161:
      return "https://arbiscan.io";
    case 421614:
      return "https://sepolia.arbiscan.io";
    default:
      return undefined;
  }
}

function serializeErrorDetails(error?: DomainError) {
  if (!error?.details) return undefined;
  return JSON.stringify(
    error.details,
    (_key, value) => (typeof value === "bigint" ? value.toString() : value),
    2
  );
}

export default function AccountPage() {
  const { release, chainId, readOnly, readOnlyReason } = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const explorerBaseUrl = React.useMemo(() => getExplorerBaseUrl(chainId), [chainId]);
  const account = sdk?.account;

  const { data: txRows = [], isLoading: txLoading } = useTxJournal(100);

  const { data: assetRows = [], isLoading: balancesLoading, error: balancesError } = useQuery({
    queryKey: ["ssot", "account", "assets", release?.releaseDigest, account],
    enabled: Boolean(release && ready && sdk && account),
    queryFn: async (): Promise<AssetAuditRow[]> => {
      if (!release || !sdk || !account) return [];
      return await Promise.all(
        release.assets.map(async (asset) => {
          const [walletBalance, allowance, position] = await Promise.all([
            sdk.bank.getAssetBalance(asset.address as `0x${string}`, account),
            sdk.bank.getAllowance(asset.address as `0x${string}`, account),
            sdk.bank.getPosition(asset.address as `0x${string}`, account),
          ]);

          return {
            id: asset.address,
            symbol: asset.symbol,
            decimals: asset.decimals,
            asset: asset.address as `0x${string}`,
            bank: asset.bank as `0x${string}`,
            walletBalance,
            shares: position.shares,
            assetsEquivalent: position.assetsEquivalent,
            allowance,
          };
        })
      );
    },
    refetchInterval: 5_000,
  });

  const {
    data: refundCredit = 0n,
    isLoading: refundLoading,
    error: refundError,
    refetch: refetchRefundCredit,
  } = useQuery({
    queryKey: ["ssot", "account", "refundCredit", chainId, account],
    enabled: Boolean(ready && sdk && account),
    queryFn: async () => {
      if (!sdk || !account) return 0n;
      return await sdk.vrfHub.getRefundCredit(account);
    },
    refetchInterval: 5_000,
  });

  const claimRefundFlow = useDirectTxAction({
    action: "CLAIM_VRF_REFUND",
    labels: {
      preflight: "Preflight",
      submit: "Submit claim",
      confirm: "Confirm on-chain",
    },
    descriptions: {
      preflight: "Validate the claim and simulate the VRFHub call.",
      submit: "Broadcast claimRefundCredit through the wallet client.",
      confirm: "Wait for receipt and journal reconciliation.",
    },
  });

  const handleClaimRefund = React.useCallback(async () => {
    if (!sdk || !account || readOnly) return;
    try {
      const res = await claimRefundFlow.execute(() => sdk.vrfHub.claimRefundCredit());
      if (!res.ok) return;
      toast.success("Refund credit claimed");
      void refetchRefundCredit();
    } catch (error) {
      toast.error((error as Error).message ?? "Refund claim failed");
    }
  }, [account, claimRefundFlow, readOnly, refetchRefundCredit, sdk]);

  const balanceColumns: DataTableColumn<AssetAuditRow>[] = React.useMemo(
    () => [
      {
        key: "asset",
        header: "Asset",
        render: (row) => (
          <div className="space-y-1">
            <div className="font-medium text-white">{row.symbol}</div>
            <div className="inline-flex items-center gap-2 font-mono text-xs text-slate-400">
              <span>{shortHex(row.asset)}</span>
              <CopyButton value={row.asset} label={`Copy ${row.symbol} address`} />
            </div>
          </div>
        ),
      },
      {
        key: "walletBalance",
        header: "Wallet Balance",
        render: (row) => <span className="font-mono text-slate-200">{formatAmount(row.walletBalance, row.decimals, row.symbol)}</span>,
      },
      {
        key: "shares",
        header: "Bank Shares",
        render: (row) => <span className="font-mono text-slate-300">{formatAmount(row.shares, row.decimals)}</span>,
      },
      {
        key: "assetsEquivalent",
        header: "Assets Eq.",
        render: (row) => <span className="font-mono text-slate-300">{formatAmount(row.assetsEquivalent, row.decimals, row.symbol)}</span>,
      },
    ],
    []
  );

  const allowanceColumns: DataTableColumn<AssetAuditRow>[] = React.useMemo(
    () => [
      {
        key: "asset",
        header: "Asset",
        render: (row) => <span className="font-medium text-white">{row.symbol}</span>,
      },
      {
        key: "allowance",
        header: "Allowance",
        render: (row) => <span className="font-mono text-slate-200">{formatAmount(row.allowance, row.decimals, row.symbol)}</span>,
      },
      {
        key: "spender",
        header: "Bank Spender",
        render: (row) => (
          <div className="inline-flex items-center gap-2 font-mono text-xs text-slate-400">
            <span>{shortHex(row.bank)}</span>
            <CopyButton value={row.bank} label={`Copy ${row.symbol} bank`} />
          </div>
        ),
      },
    ],
    []
  );

  const journalColumns: DataTableColumn<JournalRow>[] = React.useMemo(
    () => [
      {
        key: "time",
        header: "Time",
        render: (row) => (
          <span className="font-mono text-slate-400">{new Date(row.createdAt).toLocaleString()}</span>
        ),
      },
      {
        key: "action",
        header: "Action",
        render: (row) => <span className="font-medium text-white">{row.action}</span>,
      },
      {
        key: "status",
        header: "Status",
        render: (row) => (
          <span className={`font-medium ${STATUS_COLORS[row.status] ?? "text-slate-400"}`}>
            {row.status}
          </span>
        ),
      },
      {
        key: "tx",
        header: "Tx",
        render: (row) =>
          row.txHash ? (
            <span className="inline-flex items-center gap-2 font-mono text-slate-400">
              <span>{shortHex(row.txHash)}</span>
              {explorerBaseUrl ? (
                <a
                  href={`${explorerBaseUrl}/tx/${row.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-300 transition-colors hover:text-emerald-200"
                >
                  View
                </a>
              ) : null}
            </span>
          ) : (
            <span className="text-slate-500">—</span>
          ),
      },
      {
        key: "chain",
        header: "Chain",
        render: (row) => <span className="font-mono text-slate-400">{row.chainId}</span>,
      },
      {
        key: "release",
        header: "Release",
        render: (row) => (
          <div className="inline-flex items-center gap-2 font-mono text-xs text-slate-400">
            <span>{shortHex(row.releaseDigest)}</span>
            <CopyButton value={row.releaseDigest} label="Copy release digest" />
          </div>
        ),
      },
      {
        key: "block",
        header: "Block",
        render: (row) => <span className="font-mono text-slate-500">{row.blockNumber ?? "—"}</span>,
      },
      {
        key: "error",
        header: "Error",
        render: (row) => <span className="font-mono text-xs text-rose-400/70">{row.errorCode ?? ""}</span>,
      },
    ],
    [explorerBaseUrl]
  );

  const totalWalletBalance = assetRows.reduce((sum, row) => sum + row.walletBalance, 0n);
  const totalAssetsEquivalent = assetRows.reduce((sum, row) => sum + row.assetsEquivalent, 0n);
  const totalAllowance = assetRows.reduce((sum, row) => sum + row.allowance, 0n);
  const primaryAsset = release?.assets[0];

  return (
    <PageTransition pageKey="account">
      <PageHeader
        title="Account"
        description="Self-audit for wallet balances, bank allowances, VRF refund credit, release identity, and the local transaction journal."
      />

      {!account ? (
        <div className="mb-8">
          <ConnectWalletPrompt action="inspect your account state" />
        </div>
      ) : null}

      {balancesError ? (
        <div className="mb-6">
          <ErrorCallout title="Account load error" message={(balancesError as Error).message} />
        </div>
      ) : null}
      {refundError ? (
        <div className="mb-6">
          <ErrorCallout title="Refund credit load error" message={(refundError as Error).message} />
        </div>
      ) : null}

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          icon="👛"
          label={`Wallet Balance${primaryAsset ? ` (${primaryAsset.symbol})` : ""}`}
          value={account && primaryAsset ? formatAmount(totalWalletBalance, primaryAsset.decimals, primaryAsset.symbol) : "—"}
        />
        <StatCard
          icon="🏦"
          label="Assets in Bank"
          value={account && primaryAsset ? formatAmount(totalAssetsEquivalent, primaryAsset.decimals, primaryAsset.symbol) : "—"}
        />
        <StatCard
          icon="🧾"
          label="Allowance"
          value={account && primaryAsset ? formatAmount(totalAllowance, primaryAsset.decimals, primaryAsset.symbol) : "—"}
        />
        <StatCard
          icon="🎲"
          label="Refund Credit"
          value={account && primaryAsset ? formatAmount(refundCredit, primaryAsset.decimals, primaryAsset.symbol) : "—"}
        />
      </div>

      <div className="mb-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white">Balances</CardTitle>
            <CardDescription className="text-slate-400">
              Per-asset wallet balances and current Bank position.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={balanceColumns}
              data={assetRows}
              loading={balancesLoading && Boolean(account)}
              emptyMessage={account ? "No asset state available yet." : "Connect wallet to load balances."}
              rowKey={(row) => row.id}
            />
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white">Allowances</CardTitle>
            <CardDescription className="text-slate-400">
              Exact ERC20 allowances granted to each per-asset Bank spender.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={allowanceColumns}
              data={assetRows}
              loading={balancesLoading && Boolean(account)}
              emptyMessage={account ? "No allowance state available yet." : "Connect wallet to load allowances."}
              rowKey={(row) => row.id}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-white">VRF Refund Credit</CardTitle>
                <TxStatusChip status={claimRefundFlow.status} />
              </div>
              <CardDescription className="text-slate-400">
                Refund credit held in VRFHub for the connected wallet.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4 text-sm text-slate-300">
                Available credit:{" "}
                <span className="font-mono text-white">
                  {primaryAsset && account ? formatAmount(refundCredit, primaryAsset.decimals, primaryAsset.symbol) : "—"}
                </span>
              </div>

              {claimRefundFlow.error ? (
                <ErrorCallout
                  title="Transaction error"
                  message={claimRefundFlow.error.message}
                  details={serializeErrorDetails(claimRefundFlow.error)}
                />
              ) : null}

              <Button
                onClick={() => void handleClaimRefund()}
                disabled={!account || readOnly || claimRefundFlow.busy || refundCredit === 0n || refundLoading}
              >
                {claimRefundFlow.busy ? "Claiming…" : "Claim Refund Credit"}
              </Button>

              {claimRefundFlow.hasActivity ? (
                <TxStepper
                  title="Refund Credit Trace"
                  subtitle={`Status: ${claimRefundFlow.status}`}
                  steps={claimRefundFlow.steps}
                  footer={
                    <div className="space-y-2 text-xs text-slate-400">
                      {claimRefundFlow.txHash ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono">{claimRefundFlow.txHash}</span>
                          {explorerBaseUrl ? (
                            <a
                              href={`${explorerBaseUrl}/tx/${claimRefundFlow.txHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-300 transition-colors hover:text-emerald-200"
                            >
                              View tx
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                      {claimRefundFlow.journalEntry?.blockNumber ? (
                        <div>Block: {claimRefundFlow.journalEntry.blockNumber}</div>
                      ) : null}
                      <div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={claimRefundFlow.reset}
                          className="h-auto px-0 text-slate-400 hover:text-white"
                        >
                          Reset trace
                        </Button>
                      </div>
                    </div>
                  }
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-4 text-sm text-slate-500">
                  Refund claims use the standard preflight → stepper → receipt → journal flow.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">Release Identity</CardTitle>
              <CardDescription className="text-slate-400">
                Active protocol release and route execution mode.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4 border-b border-slate-800/60 py-2">
                <span className="text-slate-400">Chain</span>
                <span className="font-mono text-slate-200">{release?.chainId ?? chainId}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-800/60 py-2">
                <span className="text-slate-400">Mode</span>
                <span className={readOnly ? "text-amber-400" : "text-emerald-400"}>
                  {readOnly ? "Read-only" : "Writable"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-800/60 py-2">
                <span className="text-slate-400">Release Digest</span>
                <span className="inline-flex items-center gap-2 font-mono text-xs text-slate-200">
                  <span>{shortHex(release?.releaseDigest)}</span>
                  {release?.releaseDigest ? <CopyButton value={release.releaseDigest} label="Copy release digest" /> : null}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-800/60 py-2">
                <span className="text-slate-400">Hub</span>
                <span className="inline-flex items-center gap-2 font-mono text-xs text-slate-200">
                  <span>{shortHex(release?.contracts.hub)}</span>
                  {release?.contracts.hub ? <CopyButton value={release.contracts.hub} label="Copy hub address" /> : null}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 py-2">
                <span className="text-slate-400">VRF Hub</span>
                <span className="inline-flex items-center gap-2 font-mono text-xs text-slate-200">
                  <span>{shortHex(release?.contracts.vrfHub)}</span>
                  {release?.contracts.vrfHub ? <CopyButton value={release.contracts.vrfHub} label="Copy VRF hub address" /> : null}
                </span>
              </div>
              {readOnlyReason ? (
                <div className="pt-2 text-xs text-amber-400/80">{readOnlyReason}</div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">Transaction Journal</CardTitle>
          <CardDescription className="text-slate-400">
            Local audit trail of on-chain actions, including chain identity and release digest.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={journalColumns}
            data={txRows as JournalRow[]}
            loading={txLoading}
            emptyMessage="No transactions yet. Place a bet, provide liquidity, or claim a refund to populate the journal."
            rowKey={(row) => row.id}
          />
        </CardContent>
      </Card>
    </PageTransition>
  );
}
