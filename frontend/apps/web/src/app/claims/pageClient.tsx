"use client";

import * as React from "react";

import type { DomainError, DomainXPBuckets } from "@ssot/ssot";
import { ConnectWalletPrompt } from "../../components/ConnectWalletPrompt";
import { PageTransition } from "../../components/PageTransition";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ErrorCallout,
  GlassCard,
  Input,
  Label,
  PageHeader,
  StatCard,
  TxStatusChip,
  TxStepper,
  toast,
} from "@ssot/ui";

import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../ssot/sdk";
import { Placeholder } from "../../components/Placeholder";
import { formatUnits, parseDecimalToUnits } from "../../features/betting/model/units";
import { useDirectTxAction } from "../../features/tx/useDirectTxAction";

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

type ActionTraceProps = {
  title: string;
  status: React.ComponentProps<typeof TxStatusChip>["status"];
  steps: React.ComponentProps<typeof TxStepper>["steps"];
  hasActivity: boolean;
  error?: DomainError;
  txHash?: string;
  blockNumber?: number;
  explorerBaseUrl?: string;
  onReset: () => void;
};

function ActionTrace({
  title,
  status,
  steps,
  hasActivity,
  error,
  txHash,
  blockNumber,
  explorerBaseUrl,
  onReset,
}: ActionTraceProps) {
  if (!hasActivity && !error) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-4 text-sm text-slate-500">
        This action uses the standard preflight → stepper → receipt → journal flow once executed.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <ErrorCallout
          title="Transaction error"
          message={error.message}
          details={serializeErrorDetails(error)}
        />
      ) : null}

      <TxStepper
        title={title}
        subtitle={`Status: ${status}`}
        steps={steps}
        footer={
          <div className="space-y-2 text-xs text-slate-400">
            {txHash ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono">{txHash}</span>
                {explorerBaseUrl ? (
                  <a
                    href={`${explorerBaseUrl}/tx/${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-300 transition-colors hover:text-emerald-200"
                  >
                    View tx
                  </a>
                ) : null}
              </div>
            ) : null}
            {blockNumber ? <div>Block: {blockNumber}</div> : null}
            {hasActivity ? (
              <div>
                <Button variant="ghost" size="sm" onClick={onReset} className="h-auto px-0 text-slate-400 hover:text-white">
                  Reset trace
                </Button>
              </div>
            ) : null}
          </div>
        }
      />
    </div>
  );
}

export function ClaimsPageClient() {
  const { release, readOnly, readOnlyReason, chainId } = useRelease();
  const { sdk, ready } = useSSOTSDK();

  const assetMeta = release?.assets[0];
  const decimals = assetMeta?.decimals ?? 18;
  const sym = assetMeta?.symbol ?? "XP";
  const explorerBaseUrl = React.useMemo(() => getExplorerBaseUrl(chainId), [chainId]);

  const xpClaimFlow = useDirectTxAction({
    action: "CLAIM_XP_ACCRUED",
    labels: {
      preflight: "Preflight",
      submit: "Submit claim",
      confirm: "Confirm on-chain",
    },
    descriptions: {
      preflight: "Validate claim amount and simulate the bank call.",
      submit: "Broadcast claimXPAccrued through the wallet client.",
      confirm: "Wait for receipt and journal reconciliation.",
    },
  });

  const syncHoldbackFlow = useDirectTxAction({
    action: "SYNC_XP_HOLDBACK",
    labels: {
      preflight: "Preflight",
      submit: "Submit sync",
      confirm: "Confirm on-chain",
    },
    descriptions: {
      preflight: "Validate the sync action before signing.",
      submit: "Broadcast syncXPHoldback through the wallet client.",
      confirm: "Wait for receipt and journal reconciliation.",
    },
  });

  const protocolFeeFlow = useDirectTxAction({
    action: "CLAIM_PROTOCOL_FEES",
    labels: {
      preflight: "Preflight",
      submit: "Submit claim",
      confirm: "Confirm on-chain",
    },
    descriptions: {
      preflight: "Validate governance eligibility and simulate the bank call.",
      submit: "Broadcast claimProtocolFees through the wallet client.",
      confirm: "Wait for receipt and journal reconciliation.",
    },
  });

  // XP buckets state
  const [xpBuckets, setXPBuckets] = React.useState<DomainXPBuckets | null>(null);
  const [xpLoading, setXPLoading] = React.useState(false);
  const [xpError, setXPError] = React.useState<string | undefined>();

  const fetchXPBuckets = React.useCallback(async () => {
    if (!sdk || !ready || !sdk.account) return;
    setXPLoading(true);
    setXPError(undefined);
    try {
      const buckets = await sdk.bank.getXPBuckets(sdk.account);
      setXPBuckets(buckets);
    } catch (e) {
      setXPError((e as Error)?.message ?? "Failed to fetch XP buckets");
    } finally {
      setXPLoading(false);
    }
  }, [ready, sdk]);

  React.useEffect(() => {
    void fetchXPBuckets();
  }, [fetchXPBuckets]);

  // XP claim form
  const [xpClaimAmount, setXPClaimAmount] = React.useState("");

  const handleClaimXP = React.useCallback(async () => {
    if (!sdk || !sdk.account || readOnly) return;
    try {
      const parsed = parseDecimalToUnits(xpClaimAmount, decimals);
      if (parsed <= 0n) {
        toast.error("Amount must be positive");
        return;
      }
      const res = await xpClaimFlow.execute(() => sdk.bank.claimXPAccrued(parsed, sdk.account!));
      if (!res.ok) return;
      toast.success(`Claimed ${formatUnits(parsed, decimals)} XP`);
      setXPClaimAmount("");
      void fetchXPBuckets();
    } catch (e) {
      toast.error((e as Error)?.message ?? "XP claim failed");
    }
  }, [decimals, fetchXPBuckets, readOnly, sdk, xpClaimAmount, xpClaimFlow]);

  const handleSyncHoldback = React.useCallback(async () => {
    if (!sdk || !sdk.account || readOnly) return;
    try {
      const res = await syncHoldbackFlow.execute(() => sdk.bank.syncXPHoldback(sdk.account!));
      if (!res.ok) return;
      toast.success("Holdback synced");
      void fetchXPBuckets();
    } catch (e) {
      toast.error((e as Error)?.message ?? "Sync holdback failed");
    }
  }, [fetchXPBuckets, readOnly, sdk, syncHoldbackFlow]);

  // Protocol fee claim
  const [pfAmount, setPFAmount] = React.useState("");

  const handleClaimPF = React.useCallback(async () => {
    if (!sdk || !sdk.account || readOnly) return;
    try {
      const parsed = parseDecimalToUnits(pfAmount, decimals);
      if (parsed <= 0n) {
        toast.error("Amount must be positive");
        return;
      }
      const res = await protocolFeeFlow.execute(() =>
        sdk.bank.claimProtocolFees(parsed, sdk.account!)
      );
      if (!res.ok) return;
      toast.success(`Claimed ${formatUnits(parsed, decimals)} ${sym} protocol fees`);
      setPFAmount("");
    } catch (e) {
      toast.error((e as Error)?.message ?? "Protocol fee claim failed");
    }
  }, [decimals, pfAmount, protocolFeeFlow, readOnly, sdk, sym]);

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

  return (
    <PageTransition pageKey="claims">
      <main className="max-w-[1440px] mx-auto px-6 py-12 md:py-16">
        
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Claims & Rewards</h1>
          <p className="text-white/50 text-lg">Manage your accrued XP, sync holdback, and execute governed protocol fee withdrawals.</p>
        </div>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
           <GlassCard padding="lg" glowColor="bg-amber-500/10" className="border-amber-500/20 shadow-xl shadow-amber-900/5">
              <div className="flex flex-col gap-1">
                 <span className="text-amber-400/60 text-[10px] font-bold uppercase tracking-widest">Accrued (Claimable)</span>
                 <span className="text-2xl font-mono font-bold text-white">
                   {xpBuckets ? formatUnits(xpBuckets.accrued, decimals) : "—"}
                 </span>
                 <span className="text-[10px] text-white/30 truncate">{sym} in play bucket</span>
              </div>
           </GlassCard>
           
           <GlassCard padding="lg" glowColor="bg-blue-500/10" className="border-white/10">
              <div className="flex flex-col gap-1">
                 <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Locked (Vesting)</span>
                 <span className="text-2xl font-mono font-bold text-white">
                   {xpBuckets ? formatUnits(xpBuckets.locked, decimals) : "—"}
                 </span>
                 <span className="text-[10px] text-white/30 truncate">Vesting schedule active</span>
              </div>
           </GlassCard>

           <GlassCard padding="lg" glowColor="bg-white/5" className="border-white/10">
              <div className="flex flex-col gap-1">
                 <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Holdback</span>
                 <span className="text-2xl font-mono font-bold text-white">
                   {xpBuckets ? formatUnits(xpBuckets.holdback, decimals) : "—"}
                 </span>
                 <span className="text-[10px] text-white/30 truncate">Settlement buffer</span>
              </div>
           </GlassCard>

           <GlassCard padding="lg" glowColor="bg-cyan-500/10" className="border-cyan-500/10">
              <div className="flex flex-col gap-1">
                 <span className="text-cyan-400/60 text-[10px] font-bold uppercase tracking-widest">Holdback Releasable</span>
                 <span className="text-2xl font-mono font-bold text-white">
                   {xpBuckets ? formatUnits(xpBuckets.holdbackReleasable, decimals) : "—"}
                 </span>
                 <span className="text-[10px] text-white/30 truncate underline cursor-pointer" onClick={() => void handleSyncHoldback()}>Sync to accrued →</span>
              </div>
           </GlassCard>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-8">
           
           {/* Primary: XP Terminal */}
           <div className="space-y-6">
              <GlassCard padding="xl" glowColor="bg-amber-600/10" className="border-amber-500/20 bg-amber-950/5">
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-amber-500/10 pb-8 mb-8">
                    <div>
                        <h2 className="text-2xl font-bold mb-1">XP Terminal</h2>
                        <p className="text-amber-200/40 text-sm">Withdraw your accrued rewards directly to your wallet.</p>
                    </div>
                    <TxStatusChip status={xpClaimFlow.status} />
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="flex flex-col gap-6">
                       <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Amount to Claim ({sym})</label>
                          <div className="relative group">
                             <input 
                               type="text" 
                               value={xpClaimAmount}
                               onChange={(e) => setXPClaimAmount(e.target.value)}
                               placeholder="0.00" 
                               className="w-full bg-black/40 border-2 border-amber-500/20 rounded-xl px-4 py-4 font-mono text-xl text-white outline-none focus:border-amber-500/40 transition-all placeholder:text-white/10"
                             />
                             {xpBuckets && (
                               <button 
                                 onClick={() => setXPClaimAmount(formatUnits(xpBuckets.accrued, decimals))}
                                 className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 px-2 py-1 rounded transition-colors"
                               >
                                 Max
                               </button>
                             )}
                          </div>
                       </div>

                       <Button 
                         onClick={() => void handleClaimXP()} 
                         disabled={readOnly || xpClaimFlow.busy || !xpClaimAmount || !hasWallet}
                         className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-4 rounded-xl transition-all active:scale-95 shadow-lg shadow-amber-500/20"
                       >
                         {xpClaimFlow.busy ? "Executing Settlement..." : "Claim Accrued XP"}
                       </Button>
                    </div>

                    <div className="flex flex-col gap-4">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-amber-500/60 pb-2 border-b border-amber-500/5">Trace Manifest</div>
                        <div className="flex flex-col gap-3">
                           <ActionTrace
                              title="XP Claim Manifest"
                              status={xpClaimFlow.status}
                              steps={xpClaimFlow.steps}
                              hasActivity={xpClaimFlow.hasActivity}
                              error={xpClaimFlow.error}
                              txHash={xpClaimFlow.txHash}
                              blockNumber={xpClaimFlow.journalEntry?.blockNumber}
                              explorerBaseUrl={explorerBaseUrl}
                              onReset={xpClaimFlow.reset}
                           />
                        </div>
                    </div>
                 </div>
              </GlassCard>

              {/* Secondary: Sync Holdback */}
              <GlassCard padding="xl" className="border-white/5 bg-white/[0.01]">
                 <div className="flex items-center justify-between mb-6">
                    <div>
                       <h3 className="text-xl font-bold">Sync Holdback</h3>
                       <p className="text-white/40 text-sm">Release buffer funds into your accrued claimable bucket.</p>
                    </div>
                    <TxStatusChip status={syncHoldbackFlow.status} />
                 </div>
                 
                 <div className="flex flex-wrap items-center gap-6">
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex flex-col gap-1 min-w-[180px]">
                       <span className="text-[10px] font-bold uppercase text-white/30">Releasable Buffer</span>
                       <span className="text-lg font-mono font-bold">{xpBuckets ? formatUnits(xpBuckets.holdbackReleasable, decimals) : "—"} {sym}</span>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => void handleSyncHoldback()} 
                      disabled={readOnly || syncHoldbackFlow.busy || !hasWallet}
                      className="border-white/10 hover:bg-white/5 text-white font-bold px-8 h-14 rounded-xl transition-all active:scale-95"
                    >
                      {syncHoldbackFlow.busy ? "Syncing..." : "Run Sync Cycle"}
                    </Button>
                 </div>

                 {syncHoldbackFlow.hasActivity && (
                   <div className="mt-8 pt-8 border-t border-white/5">
                      <ActionTrace
                         title="Holdback Sync Manifest"
                         status={syncHoldbackFlow.status}
                         steps={syncHoldbackFlow.steps}
                         hasActivity={syncHoldbackFlow.hasActivity}
                         error={syncHoldbackFlow.error}
                         txHash={syncHoldbackFlow.txHash}
                         blockNumber={syncHoldbackFlow.journalEntry?.blockNumber}
                         explorerBaseUrl={explorerBaseUrl}
                         onReset={syncHoldbackFlow.reset}
                      />
                   </div>
                 )}
              </GlassCard>
           </div>

           {/* Secondary: Protocol Fees (Governed) */}
           <div className="space-y-6">
              <GlassCard padding="xl" className="border-white/5 bg-white/[0.01]">
                 <div className="flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                       <h3 className="text-xl font-bold">Governance Claims</h3>
                       <TxStatusChip status={protocolFeeFlow.status} />
                    </div>
                    <p className="text-white/40 text-sm leading-relaxed">
                       Protocol fees are governed assets. Unauthorized attempts will be rejected by the contract's ACL.
                    </p>

                    <div className="flex flex-col gap-4">
                       <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Claim Amount ({sym})</label>
                          <input 
                            type="text" 
                            value={pfAmount}
                            onChange={(e) => setPFAmount(e.target.value)}
                            placeholder="0.00" 
                            className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 font-mono text-white outline-none focus:border-white/30 transition-all"
                          />
                       </div>
                       <Button 
                         onClick={() => void handleClaimPF()} 
                         disabled={readOnly || protocolFeeFlow.busy || !pfAmount || !hasWallet}
                         className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition-all active:scale-95"
                       >
                         {protocolFeeFlow.busy ? "Executing Gov Action..." : "Claim Protocol Fees"}
                       </Button>
                    </div>

                    {protocolFeeFlow.hasActivity && (
                      <div className="mt-4">
                         <ActionTrace
                           title="Protocol Fee Manifest"
                           status={protocolFeeFlow.status}
                           steps={protocolFeeFlow.steps}
                           hasActivity={protocolFeeFlow.hasActivity}
                           error={protocolFeeFlow.error}
                           txHash={protocolFeeFlow.txHash}
                           blockNumber={protocolFeeFlow.journalEntry?.blockNumber}
                           explorerBaseUrl={explorerBaseUrl}
                           onReset={protocolFeeFlow.reset}
                         />
                      </div>
                    )}
                 </div>
              </GlassCard>

              <GlassCard padding="lg" className="border-white/5 bg-white/[0.02]">
                 <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-4">Claim Journal</h4>
                 <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                       <span className="text-sm text-white/45">Registry Digest</span>
                       <span className="text-xs font-mono text-white/60">{shortHex(release?.releaseDigest)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                       <span className="text-sm text-white/45">Bank Context</span>
                       <span className="text-xs font-mono text-white/60 underline cursor-pointer">{shortHex(release?.contracts.bankRegistry)}</span>
                    </div>
                 </div>
              </GlassCard>
           </div>
        </div>

      </main>
    </PageTransition>
  );
}

function shortHex(value?: string) {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}
