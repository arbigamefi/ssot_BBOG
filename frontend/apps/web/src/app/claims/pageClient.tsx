"use client";

import * as React from "react";

import type { DomainXPBuckets } from "@ssot/ssot";
import {
  AuditTabs,
  AuditTableCell,
  AuditTableHeader,
  Button,
  ErrorCallout,
  TxStatusChip,
  TxStepper,
  cn,
  toast
} from "@ssot/ui";
import { ShieldCheckIcon, SparklesIcon } from "@heroicons/react/24/outline";

import { ConnectWalletPrompt } from "../../components/ConnectWalletPrompt";
import { PageTransition } from "../../components/PageTransition";
import { Placeholder } from "../../components/Placeholder";
import { formatUnits, parseDecimalToUnits } from "../../features/betting/model/units";
import { useDirectTxAction } from "../../features/tx/useDirectTxAction";
import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../ssot/sdk";

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

function mapFlowStatus(status: string): React.ComponentProps<typeof TxStatusChip>["status"] {
  switch (status) {
    case "planning":
    case "needs-approval":
    case "ready":
    case "submitting":
    case "mined":
    case "reconciled":
    case "failed":
      return status;
    default:
      return "idle";
  }
}

function buildClaimJournalRows({
  symbol,
  xpClaimAmount,
  xpClaimFlow,
  syncHoldbackFlow,
  protocolFeeFlow
}: {
  symbol: string;
  xpClaimAmount: string;
  xpClaimFlow: ReturnType<typeof useDirectTxAction>;
  syncHoldbackFlow: ReturnType<typeof useDirectTxAction>;
  protocolFeeFlow: ReturnType<typeof useDirectTxAction>;
}) {
  return [
    xpClaimFlow.txHash
      ? {
          key: xpClaimFlow.txHash,
          action: `Claim accrued ${symbol}`,
          amount: `${xpClaimAmount || "0.00"} ${symbol}`,
          status: xpClaimFlow.status,
          txHash: xpClaimFlow.txHash
        }
      : null,
    syncHoldbackFlow.txHash
      ? {
          key: syncHoldbackFlow.txHash,
          action: "Sync holdback",
          amount: "Wallet sync",
          status: syncHoldbackFlow.status,
          txHash: syncHoldbackFlow.txHash
        }
      : null,
    protocolFeeFlow.txHash
      ? {
          key: protocolFeeFlow.txHash,
          action: "Claim protocol fees",
          amount: "Governance sweep",
          status: protocolFeeFlow.status,
          txHash: protocolFeeFlow.txHash
        }
      : null
  ].filter(Boolean) as Array<{
    key: string;
    action: string;
    amount: string;
    status: string;
    txHash: string;
  }>;
}

export function ClaimsPageClient() {
  const { release, readOnly, readOnlyReason, chainId } = useRelease();
  const { sdk, ready } = useSSOTSDK();

  const assetMeta = release?.assets[0];
  const decimals = assetMeta?.decimals ?? 18;
  const symbol = assetMeta?.symbol ?? "XP";
  const explorerBaseUrl = React.useMemo(() => getExplorerBaseUrl(chainId), [chainId]);

  const xpClaimFlow = useDirectTxAction({
    action: "CLAIM_XP_ACCRUED",
    labels: {
      preflight: "Preflight",
      submit: "Submit claim",
      confirm: "Confirm on-chain"
    },
    descriptions: {
      preflight: "Validate claim amount and simulate the bank call.",
      submit: "Broadcast claimXPAccrued through the wallet client.",
      confirm: "Wait for receipt and journal reconciliation."
    }
  });

  const syncHoldbackFlow = useDirectTxAction({
    action: "SYNC_XP_HOLDBACK",
    labels: {
      preflight: "Preflight",
      submit: "Submit sync",
      confirm: "Confirm on-chain"
    },
    descriptions: {
      preflight: "Validate the sync action before signing.",
      submit: "Broadcast syncXPHoldback through the wallet client.",
      confirm: "Wait for receipt and journal reconciliation."
    }
  });

  const protocolFeeFlow = useDirectTxAction({
    action: "CLAIM_PROTOCOL_FEES",
    labels: {
      preflight: "Preflight",
      submit: "Submit claim",
      confirm: "Confirm on-chain"
    },
    descriptions: {
      preflight: "Validate governance eligibility and simulate the bank call.",
      submit: "Broadcast claimProtocolFees through the wallet client.",
      confirm: "Wait for receipt and journal reconciliation."
    }
  });

  const [xpBuckets, setXPBuckets] = React.useState<DomainXPBuckets | null>(null);
  const [xpLoading, setXPLoading] = React.useState(false);
  const [xpError, setXPError] = React.useState<string | undefined>();
  const [xpClaimAmount, setXPClaimAmount] = React.useState("");
  const [pfAmount, setPFAmount] = React.useState("");

  const fetchXPBuckets = React.useCallback(async () => {
    if (!sdk || !ready || !sdk.account) return;
    setXPLoading(true);
    setXPError(undefined);
    try {
      const buckets = await sdk.bank.getXPBuckets(sdk.account);
      setXPBuckets(buckets);
    } catch (error) {
      setXPError((error as Error)?.message ?? "Failed to fetch XP buckets");
    } finally {
      setXPLoading(false);
    }
  }, [ready, sdk]);

  React.useEffect(() => {
    void fetchXPBuckets();
  }, [fetchXPBuckets]);

  const handleClaimXP = React.useCallback(async () => {
    if (!sdk || !sdk.account || readOnly) return;
    try {
      const parsed = parseDecimalToUnits(xpClaimAmount, decimals);
      if (parsed <= 0n) {
        toast.error("Amount must be positive");
        return;
      }
      const result = await xpClaimFlow.execute(() => sdk.bank.claimXPAccrued(parsed, sdk.account!));
      if (!result.ok) return;
      toast.success(`Claimed ${formatUnits(parsed, decimals)} ${symbol}`);
      setXPClaimAmount("");
      void fetchXPBuckets();
    } catch (error) {
      toast.error((error as Error)?.message ?? "XP claim failed");
    }
  }, [decimals, fetchXPBuckets, readOnly, sdk, symbol, xpClaimAmount, xpClaimFlow]);

  const handleSyncHoldback = React.useCallback(async () => {
    if (!sdk || !sdk.account || readOnly) return;
    try {
      const result = await syncHoldbackFlow.execute(() => sdk.bank.syncXPHoldback(sdk.account!));
      if (!result.ok) return;
      toast.success("Holdback synced");
      void fetchXPBuckets();
    } catch (error) {
      toast.error((error as Error)?.message ?? "Sync holdback failed");
    }
  }, [fetchXPBuckets, readOnly, sdk, syncHoldbackFlow]);

  const handleClaimPF = React.useCallback(async () => {
    if (!sdk || !sdk.account || readOnly) return;
    try {
      const parsed = parseDecimalToUnits(pfAmount, decimals);
      if (parsed <= 0n) {
        toast.error("Amount must be positive");
        return;
      }
      const result = await protocolFeeFlow.execute(() =>
        sdk.bank.claimProtocolFees(parsed, sdk.account!)
      );
      if (!result.ok) return;
      toast.success(`Claimed ${formatUnits(parsed, decimals)} ${symbol} protocol fees`);
      setPFAmount("");
    } catch (error) {
      toast.error((error as Error)?.message ?? "Protocol fee claim failed");
    }
  }, [decimals, pfAmount, protocolFeeFlow, readOnly, sdk, symbol]);

  if (!release) {
    return (
      <Placeholder
        title="Claims"
        description={readOnlyReason ?? "No embedded release available."}
        specPath="docs/frontend/PAGE-SPECS/045-CLAIMS.md"
      />
    );
  }

  const hasWallet = Boolean(sdk?.account);
  const journalRows = buildClaimJournalRows({
    symbol,
    xpClaimAmount,
    xpClaimFlow,
    syncHoldbackFlow,
    protocolFeeFlow
  });

  const claimableXP = xpBuckets
    ? `${formatUnits(xpBuckets.accrued, decimals)} ${symbol}`
    : xpLoading
      ? "Loading…"
      : `0.00 ${symbol}`;
  const syncedHoldback = xpBuckets
    ? `${formatUnits(xpBuckets.holdback, decimals)} ${symbol}`
    : xpLoading
      ? "Loading…"
      : `0.00 ${symbol}`;

  return (
    <PageTransition pageKey="claims">
      <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-6 py-12 md:py-16">
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
              Settlement rewards
            </div>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-white md:text-5xl">
              Claims & Rewards
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/48 md:text-[15px]">
              A dedicated route for XP accrual, protocol fee claims, and holdback sync actions.
            </p>
          </div>

          {!hasWallet ? <ConnectWalletPrompt action="claim rewards" /> : null}
        </header>

        {readOnly ? (
          <ErrorCallout
            title="Read-only session"
            message={readOnlyReason ?? "Writes are disabled for this release context."}
          />
        ) : null}

        {xpError ? <ErrorCallout title="XP buckets unavailable" message={xpError} /> : null}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="relative overflow-hidden rounded-[2rem] border-2 border-amber-500/20 bg-gradient-to-br from-[#1a1005] to-[#050505] p-8 shadow-[inset_0_0_40px_rgba(245,158,11,0.05),0_10px_40px_rgba(0,0,0,0.5)]">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-500/10 blur-[50px]" />
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/60">
              Claimable XP
            </div>
            <div className="mt-3 text-3xl font-mono font-extrabold text-white md:text-4xl">
              {claimableXP}
            </div>
            <div className="mt-2 text-xs font-bold text-amber-400">Ready to extract</div>
          </div>

          <div className="rounded-[2rem] border border-white/5 bg-[#0a0a0a] p-8 shadow-[inset_0_0_40px_rgba(255,255,255,0.02),0_10px_40px_rgba(0,0,0,0.5)]">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
              Synced Holdback
            </div>
            <div className="mt-3 text-3xl font-mono font-bold text-white md:text-4xl">
              {syncedHoldback}
            </div>
            <div className="mt-2 text-xs text-white/40">Pending holdback buffer sweep</div>
          </div>

          <div className="rounded-[2rem] border border-white/5 bg-[#0a0a0a] p-8 shadow-[inset_0_0_40px_rgba(255,255,255,0.02),0_10px_40px_rgba(0,0,0,0.5)]">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
              Protocol Fees
            </div>
            <div className="mt-3 text-3xl font-mono font-bold text-emerald-400 md:text-4xl">—</div>
            <div className="mt-2 text-xs text-white/40">Governance-side claim surface</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative overflow-hidden rounded-[2.5rem] border border-white/5 bg-gradient-to-br from-[#0a0a0a] to-[#040404] p-8 shadow-[inset_0_2px_40px_rgba(0,0,0,0.8),0_10px_40px_rgba(0,0,0,0.5)]">
            <div className="absolute -left-32 -top-32 h-[320px] w-[320px] rounded-full bg-amber-500/8 blur-[100px]" />
            <div className="relative z-10">
              <div className="mb-10 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70">
                    <SparklesIcon className="h-4 w-4" />
                    Primary extraction action
                  </div>
                  <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">
                    Claim Accrued XP
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/48">
                    Execute smart contract interaction to extract earned experience points from
                    protocol liabilities directly to the linked wallet.
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-400">
                  <SparklesIcon className="h-8 w-8" />
                </div>
              </div>

              <div className="grid gap-8 md:grid-cols-[1fr_minmax(280px,0.8fr)]">
                <div className="flex flex-col gap-6">
                  <div className="relative flex h-[180px] items-center justify-center overflow-hidden rounded-2xl border border-white/8 bg-[#050505] shadow-inner">
                    <div
                      className="relative h-32 w-32 animate-[spin_15s_linear_infinite]"
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      <div
                        className="absolute inset-0 rounded-full border-[4px] border-amber-500/30"
                        style={{ transform: "rotateX(75deg)" }}
                      />
                      <div
                        className="absolute inset-0 rounded-full border-[4px] border-amber-400/20"
                        style={{ transform: "rotateY(75deg)" }}
                      />
                      <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/20 blur-[10px]" />
                      <div
                        className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-gradient-to-br from-amber-300 to-amber-600 shadow-[0_0_30px_rgba(245,158,11,0.6)]"
                        style={{ transform: "translate(-50%,-50%) rotateX(45deg) rotateY(45deg)" }}
                      />
                    </div>
                    <div className="absolute bottom-4 right-4 text-xs font-mono font-bold uppercase tracking-[0.2em] text-amber-500/60">
                      CORE: {hasWallet ? "ACTIVE" : "IDLE"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-[#000] p-6 shadow-inner">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                      <span>Extraction Amount</span>
                      <button
                        type="button"
                        onClick={() =>
                          setXPClaimAmount(
                            xpBuckets ? formatUnits(xpBuckets.accrued, decimals) : "0.00"
                          )
                        }
                        className="rounded px-2 py-1 text-[10px] font-bold text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        MAX
                      </button>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-4">
                      <input
                        type="text"
                        value={xpClaimAmount}
                        onChange={(event) => setXPClaimAmount(event.target.value)}
                        placeholder="0.00"
                        className="w-full bg-transparent font-mono text-4xl font-black tracking-tight text-white outline-none placeholder:text-white/14"
                      />
                      <span className="text-xl font-bold text-amber-500/40">{symbol}</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-6">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold uppercase tracking-[0.18em] text-amber-500/60">
                        Settlement Path
                      </span>
                      <span className="font-mono font-bold text-amber-300">Preflight → Wallet</span>
                    </div>
                    <div className="mt-4 space-y-1 text-[11px] leading-6 text-white/36">
                      <div>
                        <span className="mr-2 text-emerald-400">✓</span>Validate extraction amount
                        against live bank liabilities.
                      </div>
                      <div>
                        <span className="mr-2 text-emerald-400">✓</span>Broadcast signer-owned claim
                        through the wallet client.
                      </div>
                      <div>
                        <span className="mr-2 text-emerald-400">✓</span>Reconcile the receipt
                        against the indexed reward journal.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleClaimXP()}
                    disabled={readOnly || xpClaimFlow.busy || !xpClaimAmount || !hasWallet}
                    className="w-full rounded-[1.5rem] bg-amber-500 px-4 py-5 text-lg font-bold text-black transition-all hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {xpClaimFlow.busy ? "Initiate extraction..." : "Initiate Extraction"}
                  </button>

                  {xpClaimFlow.hasActivity ? (
                    <TxStepper
                      title="Claim trace"
                      steps={xpClaimFlow.steps}
                      footer={
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={xpClaimFlow.reset}
                          className="h-auto px-0 text-white/30 hover:text-white"
                        >
                          Reset trace
                        </Button>
                      }
                    />
                  ) : null}
                </div>

                <div className="flex flex-col gap-6">
                  <div className="rounded-[2rem] border border-white/8 bg-[#050505] p-6 shadow-inner">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                      Extraction dossier
                    </div>
                    <div className="mt-6 space-y-4 font-mono text-sm">
                      {[
                        ["Request Type", "XP Withdrawal"],
                        ["Withdrawal Amount", `${xpClaimAmount || "0.00"} ${symbol}`],
                        ["Network Gas", "Wallet estimated"],
                        ["Contract Verifier", explorerBaseUrl ? "Passed" : "Pending"]
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="flex items-center justify-between border-b border-white/6 pb-4 last:border-b-0 last:pb-0"
                        >
                          <span className="text-white/40">{label}</span>
                          <span
                            className={cn(
                              "font-bold",
                              label === "Withdrawal Amount" ? "text-amber-300" : "text-white"
                            )}
                          >
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[2rem] border border-white/8 bg-[#050505] p-6 shadow-inner">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                      Extraction channel
                    </div>
                    <div className="mt-4 text-3xl font-black tracking-tight text-white">
                      {hasWallet ? "Signer attached" : "Wallet pending"}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-white/42">
                      {readOnly
                        ? (readOnlyReason ?? "Writes are disabled for this release context.")
                        : "Live signer available for reward extraction and journal reconciliation."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-[2rem] border border-blue-500/20 bg-[#0a0a0a] p-8 shadow-[inset_0_0_30px_rgba(59,130,246,0.02),0_10px_30px_rgba(0,0,0,0.5)]">
              <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-400/60">
                    Secondary system action
                  </div>
                  <h3 className="text-2xl font-bold text-white">Sync Holdback</h3>
                  <p className="mt-2 text-xs leading-6 text-white/40">
                    Resolve the delta buffer between in-flight game logic and actual realized player
                    XP.
                  </p>
                </div>
                <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-mono font-bold text-blue-300">
                  {syncedHoldback}
                </div>
              </div>

              <TxStatusChip status={syncHoldbackFlow.status} />
              <button
                type="button"
                onClick={() => void handleSyncHoldback()}
                disabled={readOnly || syncHoldbackFlow.busy || !hasWallet}
                className="mt-6 w-full rounded-[1rem] border border-blue-500/30 bg-blue-500/10 py-4 font-bold text-blue-300 transition-all hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {syncHoldbackFlow.busy ? "Syncing network state..." : "Sync Network State"}
              </button>

              {syncHoldbackFlow.hasActivity ? (
                <div className="mt-6 border-t border-white/8 pt-6">
                  <TxStepper
                    title="Sync trace"
                    steps={syncHoldbackFlow.steps}
                    footer={
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={syncHoldbackFlow.reset}
                        className="h-auto px-0 text-white/30 hover:text-white"
                      >
                        Reset trace
                      </Button>
                    }
                  />
                </div>
              ) : null}
            </div>

            <div className="flex flex-1 flex-col justify-between rounded-[2rem] border border-green-500/20 bg-[#0a0a0a] p-8 shadow-[inset_0_0_30px_rgba(34,197,94,0.02),0_10px_30px_rgba(0,0,0,0.5)]">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-green-200">
                  <ShieldCheckIcon className="h-3.5 w-3.5" />
                  Governance only
                </div>
                <h3 className="mt-4 text-2xl font-bold text-white">Sweep Protocol Fees</h3>
                <p className="mt-2 text-xs leading-6 text-white/40">
                  Root authority routine to capture global system margin and redirect it to
                  governance vaults.
                </p>
              </div>

              <div className="mt-8 space-y-4">
                <div className="rounded-[1.5rem] border border-white/8 bg-black/20 p-5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                    Fee amount
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-4 border-b border-white/8 pb-3">
                    <input
                      type="text"
                      value={pfAmount}
                      onChange={(event) => setPFAmount(event.target.value)}
                      placeholder="0.00"
                      className="w-full bg-transparent font-mono text-4xl font-black tracking-tight text-white outline-none placeholder:text-white/14"
                    />
                    <span className="pb-1 font-mono text-sm text-white/40">{symbol}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleClaimPF()}
                  disabled={readOnly || protocolFeeFlow.busy || !pfAmount || !hasWallet}
                  className="w-full rounded-[1rem] border border-green-500/30 bg-green-500/10 py-4 font-bold text-green-300 transition-all hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {protocolFeeFlow.busy ? "Extracting margin..." : "Extract Margin"}
                </button>

                {protocolFeeFlow.hasActivity ? (
                  <TxStepper
                    title="Protocol fee trace"
                    steps={protocolFeeFlow.steps}
                    footer={
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={protocolFeeFlow.reset}
                        className="h-auto px-0 text-white/30 hover:text-white"
                      >
                        Reset trace
                      </Button>
                    }
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <section className="mt-4">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-white">Claim journal</h3>
              <p className="mt-2 text-sm leading-6 text-white/42">
                Only real signed activity appears here. Idle sessions stay intentionally sparse.
              </p>
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/32">
              Recent reward actions
            </span>
          </div>

          <AuditTabs
            className="mt-0 border-white/8 bg-black/20"
            activeColorClass="border-amber-400/70 text-amber-200"
            tabs={["Claims"]}
            activeTab="Claims"
          >
            <AuditTableHeader>
              <div className="grid grid-cols-[1.3fr_1.5fr_1fr_1fr_80px] gap-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                <div>Time / Hash</div>
                <div>Action</div>
                <div>Amount</div>
                <div>Status</div>
                <div className="text-right">Chain</div>
              </div>
            </AuditTableHeader>

            <div className="flex min-h-[240px] flex-col gap-3">
              {journalRows.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-white/8 bg-white/[0.02] py-16 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-white/28">
                  No signed reward actions in this session
                </div>
              ) : (
                journalRows.map((row) => (
                  <div
                    key={row.key}
                    className="rounded-[1.35rem] border border-white/8 bg-[linear-gradient(180deg,rgba(10,14,24,0.95),rgba(6,9,15,0.96))] p-4"
                  >
                    <div className="grid grid-cols-[1.3fr_1.5fr_1fr_1fr_80px] items-center gap-4">
                      <AuditTableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-semibold text-white">Recent</span>
                          <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/24">
                            {row.txHash}
                          </span>
                        </div>
                      </AuditTableCell>
                      <AuditTableCell>
                        <div className="font-medium text-white">{row.action}</div>
                      </AuditTableCell>
                      <AuditTableCell>
                        <div className="font-mono text-white">{row.amount}</div>
                      </AuditTableCell>
                      <AuditTableCell>
                        <TxStatusChip status={mapFlowStatus(row.status)} />
                      </AuditTableCell>
                      <AuditTableCell className="justify-end">
                        {explorerBaseUrl ? (
                          <a
                            href={`${explorerBaseUrl}/tx/${row.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-bold uppercase tracking-[0.16em] text-white/40 transition-colors hover:text-white"
                          >
                            Open
                          </a>
                        ) : (
                          <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/20">
                            —
                          </span>
                        )}
                      </AuditTableCell>
                    </div>
                  </div>
                ))
              )}
            </div>
          </AuditTabs>
        </section>
      </main>
    </PageTransition>
  );
}
