"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowTopRightOnSquareIcon, UserCircleIcon, WalletIcon } from "@heroicons/react/24/outline";
import {
  AuditTabs,
  AuditTableCell,
  AuditTableHeader,
  CopyButton,
  ErrorCallout,
  TxStatusChip,
  TxStepper,
  cn,
  toast
} from "@ssot/ui";

import { ConnectWalletPrompt } from "../../components/ConnectWalletPrompt";
import { PageTransition } from "../../components/PageTransition";
import { TrustTableShell } from "../../components/TrustTableShell";
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

  const { data: txRows = [] } = useTxJournal(100);

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
    labels: {
      preflight: "Preflight",
      submit: "Submit claim",
      confirm: "Confirm on-chain"
    },
    descriptions: {
      preflight: "Validate the claim and simulate the VRFHub call.",
      submit: "Broadcast claimRefundCredit through the wallet client.",
      confirm: "Wait for receipt and journal reconciliation."
    }
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
  const explorerHref =
    explorerBaseUrl && account ? `${explorerBaseUrl}/address/${account}` : undefined;

  return (
    <PageTransition pageKey="account">
      <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-6 py-12 md:py-16">
        <header className="mb-4 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-6">
            <div className="group relative h-28 w-28 cursor-pointer">
              <div className="absolute inset-0 rounded-full bg-indigo-500/10 blur-[20px] transition-all duration-500 group-hover:bg-indigo-500/20" />
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 transition-all duration-500 group-hover:border-indigo-400/40" />
              <div className="absolute inset-2 rounded-full border border-dashed border-indigo-400/40" />
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-full border border-indigo-500/30 bg-gradient-to-br from-[#0a0a0a] to-[#111827] shadow-[inset_0_2px_15px_rgba(99,102,241,0.2)]">
                <UserCircleIcon className="h-14 w-14 text-indigo-400 drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-300/80">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                {account ? "Encrypted Identity" : "Wallet Ledger"}
              </div>
              <h1 className="flex items-center gap-3 text-4xl font-mono font-extrabold tracking-tight text-white md:text-5xl">
                {account ? shortHex(account) : "No wallet"}
                {account ? <CopyButton value={account} label="Copy wallet address" /> : null}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-white/50">
                <span>
                  {account ? "Encrypted wallet session" : "Connect a wallet to load balances"}
                </span>
                {explorerHref ? <span className="text-white/20">•</span> : null}
                {explorerHref ? (
                  <Link
                    href={explorerHref}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-emerald-400 transition-colors hover:text-emerald-300"
                  >
                    Explorer
                    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          {account ? (
            <Link
              href="/invest"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-8 py-4 text-sm font-bold text-black transition-all hover:bg-indigo-400"
            >
              Deposit / Withdraw
              <WalletIcon className="h-4 w-4" />
            </Link>
          ) : (
            <ConnectWalletPrompt action="inspect balances" />
          )}
        </header>

        {readOnly ? (
          <ErrorCallout
            title="Read-only session"
            message={readOnlyReason ?? "Writes are disabled for this release context."}
          />
        ) : null}

        {balancesError ? (
          <ErrorCallout
            title="Asset query failed"
            message={(balancesError as Error).message ?? "Unable to load account balances."}
          />
        ) : null}

        {refundError ? (
          <ErrorCallout
            title="Refund credit query failed"
            message={(refundError as Error).message ?? "Unable to load refund credit."}
          />
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <section className="relative overflow-hidden rounded-[2rem] border-2 border-indigo-500/20 bg-gradient-to-br from-indigo-950/20 to-[#050505] p-8 shadow-[inset_0_0_40px_rgba(99,102,241,0.05),0_10px_40px_rgba(0,0,0,0.5)] lg:col-span-1">
            <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-indigo-500/10 blur-[50px]" />
            <div className="relative z-10">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-300/70">
                <span className="h-2 w-2 rounded-sm bg-indigo-500/60" />
                Total Vault Value
              </div>
              <div className="mb-2 bg-gradient-to-r from-white to-indigo-200 bg-clip-text text-4xl font-mono font-extrabold text-transparent md:text-5xl">
                {primaryAsset
                  ? formatAmount(totalAssetsEquivalent, primaryAsset.decimals, primaryAsset.symbol)
                  : "—"}
              </div>
              <div className="max-w-[220px] text-xs font-medium leading-relaxed text-indigo-300/70">
                Cryptographically secured combined assets held across the embedded release banks.
              </div>
            </div>
          </section>

          <section className="relative overflow-hidden rounded-[2rem] border border-white/8 bg-[#0a0a0a] p-8 shadow-[inset_0_0_40px_rgba(255,255,255,0.02),0_10px_40px_rgba(0,0,0,0.5)] lg:col-span-3">
            <div className="mb-6 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
              Asset Breakdown
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <div className="flex flex-col">
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-white shadow-[0_0_10px_rgba(255,255,255,0.4)]" />
                  <span className="font-mono text-3xl font-bold text-white">
                    {primaryAsset
                      ? formatAmount(totalWalletBalance, primaryAsset.decimals, primaryAsset.symbol)
                      : "—"}
                  </span>
                </div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-white/38">
                  Wallet balance
                </div>
                <div className="mt-1 text-xs text-white/30">
                  Free capital before deposits, withdrawals, or bets.
                </div>
              </div>

              <div className="flex flex-col md:border-l md:border-white/5 md:pl-8">
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                  <span className="font-mono text-3xl font-bold text-blue-400">
                    {primaryAsset
                      ? formatAmount(
                          totalAssetsEquivalent,
                          primaryAsset.decimals,
                          primaryAsset.symbol
                        )
                      : "—"}
                  </span>
                </div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300/50">
                  Bank exposure
                </div>
                <div className="mt-1 text-xs text-white/30">
                  Assets-equivalent minted through house shares.
                </div>
              </div>

              <div className="flex flex-col md:border-l md:border-white/5 md:pl-8">
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                  <span className="font-mono text-3xl font-bold text-amber-400">
                    {primaryAsset
                      ? formatAmount(refundCredit, primaryAsset.decimals, primaryAsset.symbol)
                      : "—"}
                  </span>
                </div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300/50">
                  Refund credit
                </div>
                <div className="mt-1 text-xs text-white/30">
                  {claimRefundFlow.busy
                    ? "Recovery currently in-flight."
                    : "Recoverable VRF credit routed back to the same wallet."}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
          <TrustTableShell
            eyebrow="Asset positions"
            title="Wallet and bank balances"
            description="Free balance, house shares, and allowance state for every release asset remain visible in one dense ledger surface."
          >
            <div className="space-y-4">
              {balancesLoading ? (
                <div className="rounded-[1.5rem] border border-dashed border-white/8 bg-white/[0.02] py-16 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-white/28">
                  Synchronizing wallet context
                </div>
              ) : assetRows.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-white/8 bg-white/[0.02] py-16 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-white/28">
                  No release assets visible for this wallet
                </div>
              ) : (
                assetRows.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-[1.5rem] border border-white/8 bg-[linear-gradient(180deg,rgba(10,14,24,0.95),rgba(6,9,15,0.96))] p-5"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                          {row.symbol}
                        </div>
                        <div className="mt-2 text-xl font-black tracking-tight text-white">
                          {formatAmount(row.assetsEquivalent, row.decimals, row.symbol)}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-white/42">
                          Wallet free balance and bank-issued exposure visible side-by-side.
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
                        <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
                            Wallet
                          </div>
                          <div className="mt-2 font-mono text-sm text-white">
                            {formatAmount(row.walletBalance, row.decimals, row.symbol)}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
                            House shares
                          </div>
                          <div className="mt-2 font-mono text-sm text-white">
                            {formatAmount(row.shares, row.decimals)}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
                            Allowance
                          </div>
                          <div
                            className={cn(
                              "mt-2 font-mono text-sm",
                              row.allowance === 0n ? "text-rose-300" : "text-emerald-300"
                            )}
                          >
                            {row.allowance > 1_000_000_000_000_000_000n
                              ? "Unlimited"
                              : formatAmount(row.allowance, row.decimals, row.symbol)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TrustTableShell>

          <div className="space-y-8">
            <TrustTableShell
              eyebrow="Recovery"
              title="Refund credit"
              description="Failed or cancelled VRF requests accumulate refundable credit. Claiming routes funds back through the same wallet-first path."
            >
              <div className="rounded-[1.5rem] border border-indigo-400/14 bg-indigo-400/[0.05] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                      Recoverable amount
                    </div>
                    <div className="mt-3 text-3xl font-black tracking-tight text-white">
                      {primaryAsset
                        ? formatAmount(refundCredit, primaryAsset.decimals, primaryAsset.symbol)
                        : "—"}
                    </div>
                  </div>
                  <TxStatusChip status={claimRefundFlow.status} />
                </div>

                <p className="mt-4 text-sm leading-6 text-white/46">
                  Recovery stays explicit: validate the claim, submit from the wallet, then
                  reconcile the receipt in the journal.
                </p>

                <button
                  type="button"
                  onClick={() => void handleClaimRefund()}
                  disabled={!account || readOnly || claimRefundFlow.busy || refundCredit === 0n}
                  className="mt-6 w-full rounded-2xl bg-indigo-500 px-4 py-4 text-sm font-bold text-black transition-all hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {claimRefundFlow.busy ? "Claiming refund credit..." : "Claim refund credit"}
                </button>

                {claimRefundFlow.hasActivity ? (
                  <div className="mt-6 border-t border-white/8 pt-6">
                    <TxStepper
                      title="Recovery trace"
                      steps={claimRefundFlow.steps}
                      footer={
                        <button
                          type="button"
                          onClick={claimRefundFlow.reset}
                          className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30 transition-colors hover:text-white"
                        >
                          Reset trace
                        </button>
                      }
                    />
                  </div>
                ) : null}
              </div>
            </TrustTableShell>

            <TrustTableShell
              eyebrow="Protocol context"
              title="Runtime envelope"
              description="The account route remains explicit about chain, release identity, and current write permissions."
            >
              <div className="space-y-3">
                {[
                  ["Release digest", shortHex(release?.releaseDigest)],
                  ["Network", release?.name ?? "Unknown"],
                  ["Explorer", explorerBaseUrl ?? "Unavailable"],
                  ["Session mode", readOnly ? "Read-only" : "Writable"]
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-3"
                  >
                    <span className="text-sm text-white/46">{label}</span>
                    <span className="font-mono text-sm text-white">{value}</span>
                  </div>
                ))}
              </div>
            </TrustTableShell>
          </div>
        </div>

        <TrustTableShell
          eyebrow="Journal"
          title="Recent account receipts"
          description="Every direct transaction stays visible as a compact, chain-aware journal row."
        >
          <AuditTabs
            className="mt-0 border-white/8 bg-black/20"
            activeColorClass="border-cyan-400/70 text-cyan-200"
            tabs={["Transactions"]}
            activeTab="Transactions"
          >
            <AuditTableHeader>
              <div className="grid grid-cols-[1.4fr_1.4fr_1fr_1fr_72px] gap-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                <div>Time / Hash</div>
                <div>Action</div>
                <div>Release</div>
                <div>Status</div>
                <div className="text-right">Chain</div>
              </div>
            </AuditTableHeader>

            <div className="flex min-h-[280px] flex-col gap-3">
              {journalRows.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-white/8 bg-white/[0.02] py-16 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-white/28">
                  Journal is empty for this wallet session
                </div>
              ) : (
                journalRows.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-[1.35rem] border border-white/8 bg-[linear-gradient(180deg,rgba(10,14,24,0.95),rgba(6,9,15,0.96))] p-4"
                  >
                    <div className="grid grid-cols-[1.4fr_1.4fr_1fr_1fr_72px] items-center gap-4">
                      <AuditTableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-semibold text-white">
                            {new Date(row.createdAt).toLocaleString()}
                          </span>
                          <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/24">
                            {shortHex(row.txHash)}
                          </span>
                        </div>
                      </AuditTableCell>
                      <AuditTableCell>
                        <span className="text-sm font-semibold text-white">
                          {row.action.replace(/_/g, " ")}
                        </span>
                      </AuditTableCell>
                      <AuditTableCell>
                        <span className="font-mono text-sm text-white/62">
                          {shortHex(row.releaseDigest)}
                        </span>
                      </AuditTableCell>
                      <AuditTableCell>
                        <TxStatusChip status={mapJournalStatus(row.status)} />
                      </AuditTableCell>
                      <AuditTableCell className="justify-end text-[11px] font-bold uppercase tracking-[0.18em] text-white/30">
                        {row.chainId}
                      </AuditTableCell>
                    </div>
                  </div>
                ))
              )}
            </div>
          </AuditTabs>
        </TrustTableShell>
      </main>
    </PageTransition>
  );
}
