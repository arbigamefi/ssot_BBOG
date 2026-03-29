"use client";

import * as React from "react";

import type { DomainXPBuckets } from "@ssot/ssot";
import {
  AuditTableCell,
  AuditTableHeader,
  Button,
  ErrorCallout,
  TxStatusChip,
  TxStepper,
  cn,
  toast
} from "@ssot/ui";
import { ShieldCheckIcon, SparklesIcon, ArrowsRightLeftIcon } from "@heroicons/react/24/outline";

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

// Reusable Dense Stat Block
function StatBlock({
  label,
  value,
  subtext,
  glowColor = "amber",
  icon: Icon
}: {
  label: string;
  value: string;
  subtext: string;
  glowColor?: "amber" | "blue" | "emerald";
  icon?: React.ElementType;
}) {
  const colors = {
    amber:
      "border-amber-500/20 bg-[#0a0600] text-amber-500 shadow-[inset_0_0_40px_rgba(245,158,11,0.03)]",
    blue: "border-blue-500/20 bg-[#00050a] text-blue-400 shadow-[inset_0_0_40px_rgba(59,130,246,0.03)]",
    emerald:
      "border-emerald-500/20 bg-[#000a05] text-emerald-400 shadow-[inset_0_0_40px_rgba(16,185,129,0.03)]"
  };
  const labelColors = {
    amber: "text-amber-500/60",
    blue: "text-blue-400/60",
    emerald: "text-emerald-400/60"
  };

  return (
    <div className={cn("relative overflow-hidden rounded-xl border p-5", colors[glowColor])}>
      <div
        className={cn(
          "flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em]",
          labelColors[glowColor]
        )}
      >
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <div className="mt-3 text-2xl font-mono font-black tracking-tight">{value}</div>
      <div className="mt-1 text-xs opacity-50">{subtext}</div>
    </div>
  );
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
      preflight: "Simulating bank call.",
      submit: "Broadcasting claimXPAccrued.",
      confirm: "Waiting for receipt."
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
      preflight: "Validating sync action.",
      submit: "Broadcasting syncXPHoldback.",
      confirm: "Waiting for receipt."
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
      preflight: "Validating governance.",
      submit: "Broadcasting claimProtocolFees.",
      confirm: "Waiting for receipt."
    }
  });

  const [xpBuckets, setXPBuckets] = React.useState<DomainXPBuckets | null>(null);
  const [xpLoading, setXPLoading] = React.useState(false);
  const [xpError, setXPError] = React.useState<string | undefined>();
  const [xpClaimAmount, setXPClaimAmount] = React.useState("");
  const [pfAmount, setPFAmount] = React.useState("");
  const [activeAction, setActiveAction] = React.useState<"extract" | "sync" | "sweep">("extract");

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
      const parsed = parseDecimalToUnits(xpClaimAmount || "0", decimals);
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
      const parsed = parseDecimalToUnits(pfAmount || "0", decimals);
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

  const rawClaimable = xpBuckets ? formatUnits(xpBuckets.accrued, decimals) : "0.00";
  const claimableXP = xpLoading && !xpBuckets ? "..." : rawClaimable;

  const rawHoldback = xpBuckets ? formatUnits(xpBuckets.holdback, decimals) : "0.00";
  const syncedHoldback = xpLoading && !xpBuckets ? "..." : rawHoldback;

  const journalRows = [
    ...(xpClaimFlow.txHash
      ? [
          {
            key: xpClaimFlow.txHash,
            action: "Claim XP",
            amount: `${xpClaimAmount || rawClaimable} ${symbol}`,
            status: xpClaimFlow.status,
            txHash: xpClaimFlow.txHash
          }
        ]
      : []),
    ...(syncHoldbackFlow.txHash
      ? [
          {
            key: syncHoldbackFlow.txHash,
            action: "Sync Holdback",
            amount: "State Sync",
            status: syncHoldbackFlow.status,
            txHash: syncHoldbackFlow.txHash
          }
        ]
      : []),
    ...(protocolFeeFlow.txHash
      ? [
          {
            key: protocolFeeFlow.txHash,
            action: "Sweep Fees",
            amount: `${pfAmount || "0"} ${symbol}`,
            status: protocolFeeFlow.status,
            txHash: protocolFeeFlow.txHash
          }
        ]
      : [])
  ];

  return (
    <PageTransition pageKey="claims">
      <main className="mx-auto flex h-[calc(100vh-80px)] max-w-[1600px] flex-col overflow-hidden px-4 py-6 md:px-8">
        <header className="mb-6 flex shrink-0 items-end justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">
              Treasury Vault
            </h1>
            <p className="mt-1 text-sm text-white/40">Settle margin and extract rewards.</p>
          </div>
          {!hasWallet && <ConnectWalletPrompt action="claim rewards" />}
        </header>

        {readOnly && (
          <div className="mb-6 shrink-0">
            <ErrorCallout
              title="Read-only session"
              message={readOnlyReason ?? "Writes are disabled for this release context."}
            />
          </div>
        )}
        {xpError && (
          <div className="mb-6 shrink-0">
            <ErrorCallout title="XP buckets unavailable" message={xpError} />
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
          {/* Left Column: Data & Ledger */}
          <div className="flex w-full flex-col gap-6 lg:w-[60%]">
            {/* Stat Blocks */}
            <div className="grid shrink-0 grid-cols-1 gap-4 md:grid-cols-3">
              <StatBlock
                icon={SparklesIcon}
                label="Claimable XP"
                value={`${claimableXP} ${symbol}`}
                subtext="Ready to extract"
                glowColor="amber"
              />
              <StatBlock
                icon={ArrowsRightLeftIcon}
                label="Unsynced Holdback"
                value={`${syncedHoldback} ${symbol}`}
                subtext="Pending buffer sweep"
                glowColor="blue"
              />
              <StatBlock
                icon={ShieldCheckIcon}
                label="Protocol Fees"
                value={`— ${symbol}`}
                subtext="Governance claim surface"
                glowColor="emerald"
              />
            </div>

            {/* Claim Journal (Dense) */}
            <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-white/5 bg-[#050505]">
              <div className="shrink-0 border-b border-white/10 p-4">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">
                  Journal
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <AuditTableHeader className="mb-2">
                  <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_60px] gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                    <div>Hash</div>
                    <div>Action</div>
                    <div>Amount</div>
                    <div>Status</div>
                    <div className="text-right">Tx</div>
                  </div>
                </AuditTableHeader>

                <div className="flex flex-col gap-2">
                  {journalRows.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] py-12 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-white/28">
                      No rewards extracted this session
                    </div>
                  ) : (
                    journalRows.map((row) => (
                      <div
                        key={row.key}
                        className="group rounded-md border border-white/5 bg-[#0a0a0a] p-3 transition-colors hover:bg-[#111]"
                      >
                        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_60px] items-center gap-2">
                          <AuditTableCell>
                            <div className="font-mono text-[11px] uppercase tracking-wider text-white/50">
                              {row.txHash.slice(0, 6)}...{row.txHash.slice(-4)}
                            </div>
                          </AuditTableCell>
                          <AuditTableCell>
                            <span className="text-xs font-semibold text-white">{row.action}</span>
                          </AuditTableCell>
                          <AuditTableCell>
                            <span className="font-mono text-xs text-white/80">{row.amount}</span>
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
                                className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 hover:text-white"
                              >
                                View
                              </a>
                            ) : (
                              <span className="text-[10px] text-white/20">—</span>
                            )}
                          </AuditTableCell>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Execution Terminal */}
          <div className="flex w-full flex-col overflow-hidden rounded-xl border border-white/10 bg-[#050505] lg:w-[40%]">
            {/* Terminal Tabs */}
            <div className="flex shrink-0 border-b border-white/10 text-[10px] font-bold uppercase tracking-[0.15em]">
              {(["extract", "sync", "sweep"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveAction(tab)}
                  className={cn(
                    "flex-1 px-4 py-4 text-center transition-colors",
                    activeAction === tab
                      ? "bg-white/5 text-white"
                      : "text-white/40 hover:bg-white/5 hover:text-white/80"
                  )}
                >
                  {tab === "extract"
                    ? "Extract XP"
                    : tab === "sync"
                      ? "Sync State"
                      : "Sweep Margin"}
                </button>
              ))}
            </div>

            {/* Terminal Body */}
            <div className="flex flex-1 flex-col overflow-y-auto p-6">
              {activeAction === "extract" && (
                <div className="flex flex-col gap-6">
                  <div className="text-sm text-white/50">
                    Execute a smart contract claim to extract earned {symbol} from protocol
                    liabilities directly to your wallet.
                  </div>
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.15em] text-amber-500/60">
                      <span>Amount</span>
                      <button
                        type="button"
                        onClick={() => setXPClaimAmount(rawClaimable)}
                        className="rounded bg-amber-500/20 px-2 py-1 text-amber-500 hover:bg-amber-500/30"
                      >
                        MAX
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={xpClaimAmount}
                        onChange={(e) => setXPClaimAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-transparent font-mono text-3xl font-black text-amber-400 outline-none placeholder:text-amber-500/20"
                      />
                      <span className="font-mono text-sm font-bold text-amber-500/50">
                        {symbol}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleClaimXP()}
                    disabled={readOnly || xpClaimFlow.busy || !xpClaimAmount || !hasWallet}
                    className="w-full rounded-lg bg-amber-500 py-4 font-bold text-black transition-all hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {xpClaimFlow.busy ? "Executing Extract..." : "Execute Extract"}
                  </button>

                  {xpClaimFlow.hasActivity && (
                    <div className="mt-4">
                      <TxStepper steps={xpClaimFlow.steps} title="Extraction Trace" />
                    </div>
                  )}
                </div>
              )}

              {activeAction === "sync" && (
                <div className="flex flex-col gap-6">
                  <div className="text-sm text-white/50">
                    Resolve the delta buffer between in-flight game logic and actual realized player
                    XP.
                  </div>
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-blue-400/60">
                      Pending Sync
                    </div>
                    <div className="mt-1 font-mono text-3xl font-black text-blue-400">
                      {syncedHoldback} <span className="text-sm text-blue-500/50">{symbol}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleSyncHoldback()}
                    disabled={readOnly || syncHoldbackFlow.busy || !hasWallet}
                    className="w-full rounded-lg bg-blue-500 py-4 font-bold text-black transition-all hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {syncHoldbackFlow.busy ? "Executing Sync..." : "Execute State Sync"}
                  </button>

                  {syncHoldbackFlow.hasActivity && (
                    <div className="mt-4">
                      <TxStepper steps={syncHoldbackFlow.steps} title="Sync Trace" />
                    </div>
                  )}
                </div>
              )}

              {activeAction === "sweep" && (
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-400">
                    <ShieldCheckIcon className="h-4 w-4" /> Root Authority Required
                  </div>
                  <div className="text-sm text-white/50">
                    Capture global system margin and redirect to governance vaults.
                  </div>
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-500/60">
                      Sweep Amount
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={pfAmount}
                        onChange={(e) => setPFAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-transparent font-mono text-3xl font-black text-emerald-400 outline-none placeholder:text-emerald-500/20"
                      />
                      <span className="font-mono text-sm font-bold text-emerald-500/50">
                        {symbol}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleClaimPF()}
                    disabled={readOnly || protocolFeeFlow.busy || !pfAmount || !hasWallet}
                    className="w-full rounded-lg bg-emerald-500 py-4 font-bold text-black transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {protocolFeeFlow.busy ? "Executing Sweep..." : "Execute Sweep"}
                  </button>

                  {protocolFeeFlow.hasActivity && (
                    <div className="mt-4">
                      <TxStepper steps={protocolFeeFlow.steps} title="Sweep Trace" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </PageTransition>
  );
}
