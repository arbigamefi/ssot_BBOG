"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowTopRightOnSquareIcon,
  UserCircleIcon,
  WalletIcon,
  CheckCircleIcon
} from "@heroicons/react/24/outline";
import { CopyButton, ErrorCallout, TxStatusChip, TxStepper, cn, toast } from "@ssot/ui";

import { ConnectWalletPrompt } from "../../components/ConnectWalletPrompt";
import { PageTransition } from "../../components/PageTransition";
import { useTxJournal } from "../../features/account/useTxJournal";
import { formatUnits } from "../../features/betting/model/units";
import { useDirectTxAction } from "../../features/tx/useDirectTxAction";
import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../ssot/sdk";

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
  releaseDigest: string;
  chainId: number;
};

function shortHex(value?: string) {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
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

function mapJournalStatus(
  status: JournalRow["status"]
): React.ComponentProps<typeof TxStatusChip>["status"] {
  switch (status) {
    case "submitted":
      return "submitting";
    case "mined":
      return "mined";
    case "failed":
    case "timeout":
      return "failed";
    default:
      return "idle";
  }
}

export default function AccountPage() {
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
    queryFn: async (): Promise<AssetAuditRow[]> => {
      if (!release || !sdk || !account) return [];
      return await Promise.all(
        release.assets.map(async (asset) => {
          const [walletBalance, allowance, position] = await Promise.all([
            sdk.bank.getAssetBalance(asset.address as `0x${string}`, account),
            sdk.bank.getAllowance(asset.address as `0x${string}`, account),
            sdk.bank.getPosition(asset.address as `0x${string}`, account)
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
      return await sdk.vrfHub.getRefundCredit(account);
    },
    refetchInterval: 5_000
  });

  const claimRefundFlow = useDirectTxAction({
    action: "CLAIM_VRF_REFUND",
    labels: { preflight: "Preflight", submit: "Submit claim", confirm: "Confirm on-chain" },
    descriptions: { preflight: "Validating claim.", submit: "Broadcasting.", confirm: "Waiting." }
  });

  const handleClaimRefund = React.useCallback(async () => {
    if (!sdk || !account || readOnly) return;
    try {
      const result = await claimRefundFlow.execute(() => sdk.vrfHub.claimRefundCredit());
      if (!result.ok) return;
      toast.success("Refund credit claimed");
      void refetchRefundCredit();
    } catch (error) {
      toast.error((error as Error).message ?? "Refund claim failed");
    }
  }, [account, claimRefundFlow, readOnly, refetchRefundCredit, sdk]);

  const primaryAsset = release?.assets[0];
  const totalAssetsEquivalent = assetRows.reduce((sum, row) => sum + row.assetsEquivalent, 0n);
  const totalWalletBalance = assetRows.reduce((sum, row) => sum + row.walletBalance, 0n);
  const journalRows = txRows as JournalRow[];

  // Player ID Auto-save logic
  const [alias, setAlias] = React.useState("");
  const [debouncedAlias, setDebouncedAlias] = React.useState("");
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem("ssot.player_alias") || "";
    setAlias(saved);
    setDebouncedAlias(saved);
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedAlias(alias), 600);
    return () => clearTimeout(t);
  }, [alias]);

  React.useEffect(() => {
    if (!isMounted) return;
    const current = localStorage.getItem("ssot.player_alias") || "";
    if (debouncedAlias !== current) {
      localStorage.setItem("ssot.player_alias", debouncedAlias);
      toast.success("Player ID auto-saved globally.", { icon: "💾" });
    }
  }, [debouncedAlias, isMounted]);

  return (
    <PageTransition pageKey="account">
      <main className="mx-auto flex h-[calc(100vh-80px)] max-w-[1600px] flex-col overflow-hidden px-4 md:px-8 py-6">
        <header className="mb-6 flex shrink-0 items-end justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">
              Player Identity
            </h1>
            <p className="mt-1 text-sm text-white/40">
              Manage profile, assets, and execution environment.
            </p>
          </div>
          {!account ? (
            <ConnectWalletPrompt action="view profile" />
          ) : (
            <Link
              href="/invest"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-xs font-bold uppercase tracking-widest text-black transition-all hover:bg-indigo-400"
            >
              Deposit Margin <WalletIcon className="h-4 w-4" />
            </Link>
          )}
        </header>

        {readOnly && (
          <div className="mb-6 shrink-0">
            <ErrorCallout
              title="Read-only session"
              message={readOnlyReason ?? "Writes are disabled."}
            />
          </div>
        )}
        {balancesError && (
          <div className="mb-6 shrink-0">
            <ErrorCallout title="Asset query failed" message={(balancesError as Error).message} />
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
          {/* Left Panel: Profile & Context */}
          <div className="flex w-full shrink-0 flex-col gap-6 lg:w-[350px]">
            {/* Player ID Card */}
            <div className="relative overflow-hidden rounded-xl border border-indigo-500/20 bg-gradient-to-br from-[#050510] to-[#010105] p-6 shadow-[inset_0_0_40px_rgba(99,102,241,0.05)]">
              <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-indigo-500/10 blur-[50px] pointer-events-none" />
              <div className="relative z-10 flex flex-col items-center">
                <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-indigo-500/30 bg-black shadow-[0_0_20px_rgba(99,102,241,0.2)]">
                  <UserCircleIcon className="h-10 w-10 text-indigo-400" />
                  <div className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-black bg-emerald-500" />
                </div>

                <input
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="Enter Alias"
                  className="w-full bg-transparent text-center text-xl font-black tracking-tight text-white outline-none placeholder:text-white/20 transition-all focus:text-indigo-300"
                  disabled={!account}
                />
                <div className="mt-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                  {debouncedAlias !== alias ? (
                    "Saving..."
                  ) : (
                    <>
                      <CheckCircleIcon className="h-3 w-3 text-emerald-500" /> Auto-saved
                    </>
                  )}
                </div>

                <div className="mt-6 w-full rounded-lg border border-white/10 bg-black/40 p-3 shadow-inner">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-indigo-200/80">
                      {account ? shortHex(account) : "Unconnected"}
                    </span>
                    {account && (
                      <CopyButton
                        value={account}
                        label="Copy"
                        className="h-6 px-2 text-[10px] bg-white/5 hover:bg-white/10"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Protocol Context */}
            <div className="flex flex-col gap-2 rounded-xl border border-white/5 bg-[#0a0a0a] p-4 text-[10px] uppercase tracking-[0.15em] text-white/40">
              <div className="mb-2 font-bold text-white/60">Execution Context</div>
              <div className="flex justify-between">
                <span>Session:</span>{" "}
                <span className="font-mono text-white/80">
                  {readOnly ? "Read-Only" : "Writable"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Network:</span>{" "}
                <span className="font-mono text-white/80">{release?.name || "Unknown"}</span>
              </div>
              <div className="flex justify-between">
                <span>Digest:</span>{" "}
                <span className="font-mono text-white/80">{shortHex(release?.releaseDigest)}</span>
              </div>
            </div>

            {/* Refund Vault */}
            <div className="flex flex-col gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-500/60">
                Recoverable VRF Credit
              </div>
              <div className="font-mono text-2xl font-black text-amber-400">
                {primaryAsset
                  ? formatAmount(refundCredit, primaryAsset.decimals, primaryAsset.symbol)
                  : "—"}
              </div>
              <button
                type="button"
                onClick={() => void handleClaimRefund()}
                disabled={!account || readOnly || claimRefundFlow.busy || refundCredit === 0n}
                className="w-full rounded-lg bg-amber-500 py-3 text-xs font-bold text-black transition-all hover:bg-amber-400 disabled:opacity-40"
              >
                {claimRefundFlow.busy ? "Claiming..." : "Claim Credit"}
              </button>
              {claimRefundFlow.hasActivity && (
                <TxStepper steps={claimRefundFlow.steps} title="Trace" />
              )}
            </div>
          </div>

          {/* Middle Panel: Asset Ledger */}
          <div className="flex flex-1 flex-col gap-6 overflow-hidden">
            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-4 shrink-0">
              <div className="flex flex-col rounded-xl border border-white/10 bg-white/[0.03] p-4 shadow-inner">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                  Total Vault Value
                </div>
                <div className="mt-1 font-mono text-2xl font-black text-white">
                  {primaryAsset
                    ? formatAmount(
                        totalAssetsEquivalent,
                        primaryAsset.decimals,
                        primaryAsset.symbol
                      )
                    : "—"}
                </div>
              </div>
              <div className="flex flex-col rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 shadow-inner">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400/60">
                  Free Balance
                </div>
                <div className="mt-1 font-mono text-2xl font-black text-indigo-400">
                  {primaryAsset
                    ? formatAmount(totalWalletBalance, primaryAsset.decimals, primaryAsset.symbol)
                    : "—"}
                </div>
              </div>
              <div className="flex flex-col rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 shadow-inner">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400/60">
                  Bank Exposure
                </div>
                <div className="mt-1 font-mono text-2xl font-black text-blue-400">
                  {primaryAsset
                    ? formatAmount(
                        totalAssetsEquivalent,
                        primaryAsset.decimals,
                        primaryAsset.symbol
                      )
                    : "—"}
                </div>
              </div>
            </div>

            {/* Detailed Position rows */}
            <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-white/5 bg-[#050505]">
              <div className="shrink-0 border-b border-white/10 p-4">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                  Asset Positions
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {balancesLoading ? (
                  <div className="py-12 text-center text-[11px] font-bold uppercase tracking-widest text-white/30">
                    Loading Balances...
                  </div>
                ) : assetRows.length === 0 ? (
                  <div className="py-12 text-center text-[11px] font-bold uppercase tracking-widest text-white/30">
                    No Assets Available
                  </div>
                ) : (
                  assetRows.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-lg border border-white/10 bg-[#0a0a0a] p-4 shadow-sm"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 font-mono text-sm font-black text-white">
                          <span className="h-2 w-2 rounded-full bg-emerald-400" /> {row.symbol}{" "}
                          Equivalent
                        </div>
                        <div className="font-mono text-lg font-bold text-white">
                          {formatAmount(row.assetsEquivalent, row.decimals)}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[10px] uppercase tracking-widest">
                        <div className="flex flex-col gap-1 rounded bg-black/40 p-2 border border-white/5">
                          <span className="text-white/40">Wallet</span>
                          <span className="font-mono text-xs font-bold text-white/80">
                            {formatAmount(row.walletBalance, row.decimals)}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 rounded bg-black/40 p-2 border border-white/5">
                          <span className="text-white/40">House Shares</span>
                          <span className="font-mono text-xs font-bold text-white/80">
                            {formatAmount(row.shares, row.decimals)}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 rounded bg-black/40 p-2 border border-white/5">
                          <span className="text-white/40">Allowance</span>
                          <span
                            className={cn(
                              "font-mono text-xs font-bold",
                              row.allowance === 0n ? "text-rose-400" : "text-emerald-400"
                            )}
                          >
                            {row.allowance > 1_000_000_000_000_000_000n
                              ? "Unlimited"
                              : formatAmount(row.allowance, row.decimals)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Panel: Network Activity */}
          <div className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-white/5 bg-[#050505] lg:w-[380px]">
            <div className="shrink-0 border-b border-white/10 p-4">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                Tx Journal
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {journalRows.length === 0 ? (
                <div className="py-12 text-center text-[10px] font-bold uppercase tracking-widest text-white/30">
                  Journal empty
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {journalRows.map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-col gap-2 rounded-lg border border-white/5 bg-[#0a0a0a] p-3 transition-colors hover:bg-[#111]"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white">
                          {row.action.replace(/_/g, " ")}
                        </span>
                        <TxStatusChip status={mapJournalStatus(row.status)} />
                      </div>
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-white/40">
                        <span className="font-mono">
                          {new Date(row.createdAt).toLocaleTimeString()}
                        </span>
                        {explorerBaseUrl && row.txHash ? (
                          <a
                            href={`${explorerBaseUrl}/tx/${row.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-400 hover:text-indigo-300"
                          >
                            {shortHex(row.txHash)} ↗
                          </a>
                        ) : (
                          <span className="font-mono">{shortHex(row.txHash)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </PageTransition>
  );
}
