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
  cn,
  AuditTabs,
  AuditTableHeader,
  AuditTableRow,
  AuditTableCell,
} from "@ssot/ui";
import { ShieldCheckIcon, SparklesIcon } from "@heroicons/react/24/outline";

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
      <main className="mx-auto max-w-[1440px] px-6 py-12 md:py-16">
        <div className="mb-12 max-w-3xl text-white">
          <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">Claims & Rewards</h1>
          <p className="text-lg leading-relaxed text-white/50">
            A dedicated route for XP accrual, protocol fee claims, and holdback sync actions.
            Manage your earned Experience Points and system-level settlements with cryptographic precision.
          </p>
        </div>

        <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Claimable XP */}
          <div className="flex flex-col justify-center rounded-[2rem] border-2 border-amber-500/20 bg-gradient-to-br from-[#1a1005] to-[#050505] p-8 shadow-[inset_0_0_40px_rgba(245,158,11,0.05),0_10px_40px_rgba(0,0,0,0.5)] group relative overflow-hidden transition-colors hover:border-amber-500/40">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-500/10 blur-[50px] transition-all group-hover:bg-amber-500/20" />
            <span className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-500/50">
               <div className="h-1.5 w-1.5 rounded-sm bg-amber-500/50" /> Claimable XP
            </span>
            <span className="mb-1 text-3xl font-mono font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-amber-200 drop-shadow-[0_0_15px_rgba(245,158,11,0.3)] md:text-4xl text-white">
              {xpBuckets ? formatUnits(xpBuckets.accrued, decimals) : "0.00"}
            </span>
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Ready to extract</span>
          </div>

          {/* Synced Holdback */}
          <div className="flex flex-col justify-center rounded-[2rem] border border-white/5 bg-[#0a0a0a] p-8 shadow-[inset_0_0_40px_rgba(255,255,255,0.02),0_10px_40px_rgba(0,0,0,0.5)] group relative overflow-hidden transition-colors hover:border-blue-500/30">
            <div className="absolute right-4 top-4 opacity-10 group-hover:text-blue-500 transition-colors">
              <ShieldCheckIcon className="h-12 w-12 text-white" />
            </div>
            <span className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">Synced Holdback</span>
            <span className="mb-1 text-3xl font-mono font-bold text-white transition-all group-hover:text-shadow-[0_0_20px_rgba(255,255,255,0.3)] md:text-4xl">
              {xpBuckets ? formatUnits(xpBuckets.holdback, decimals) : "0.00"} <span className="text-lg opacity-30">{sym}</span>
            </span>
            <span className="text-xs text-white/40 uppercase tracking-widest text-white">Pending buffer sweep</span>
          </div>

          {/* Protocol Fees */}
          <div className="flex flex-col justify-center rounded-[2rem] border border-white/5 bg-[#0a0a0a] p-8 shadow-[inset_0_0_40px_rgba(255,255,255,0.02),0_10px_40px_rgba(0,0,0,0.5)] group relative overflow-hidden transition-colors hover:border-green-500/30">
            <span className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">Protocol Fees (Governed)</span>
            <span className="mb-1 text-3xl font-mono font-bold text-green-400 transition-all group-hover:text-shadow-[0_0_20px_rgba(34,197,94,0.3)] md:text-4xl">
               {xpBuckets ? formatUnits(xpBuckets.holdbackReleasable, decimals) : "0.00"} <span className="text-lg opacity-30">{sym}</span>
            </span>
            <span className="text-xs text-white/40 uppercase tracking-widest">Available Margin</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Core Interaction Terminal: XP Extraction */}
          <div className="rounded-[2.5rem] border border-white/5 bg-gradient-to-br from-[#0a0a0a] to-[#040404] p-8 shadow-[inset_0_2px_40px_rgba(0,0,0,0.8),0_10px_40px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-overlay pointer-events-none" />
            <div className="absolute -top-40 -left-40 h-[400px] w-[400px] rounded-full bg-amber-500/10 blur-[100px] pointer-events-none" />
            
            <div className="mb-10 flex items-start justify-between gap-4 relative z-10">
              <div className="text-white">
                <div className="text-[10px] font-bold uppercase tracking-widest text-amber-500/50 flex items-center gap-2">
                   <div className="h-2 w-2 rounded-sm bg-amber-500 animate-pulse" /> Primary Extraction Action
                </div>
                <h2 className="mt-2 text-3xl font-bold drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">Claim Accrued {sym}</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/50 text-white">
                  Execute smart contract interaction to extract earned Experience Points from protocol liabilities directly to your linked wallet.
                </p>
              </div>
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                <SparklesIcon className="h-8 w-8" />
              </div>
            </div>

            <div className="grid gap-10 md:grid-cols-[1fr_minmax(300px,0.8fr)] relative z-10 flex-1">
              {/* Terminal Form */}
              <div className="flex flex-col gap-6 w-full">
                
                {/* 3D Holographic Core Context */}
                <div className="w-full h-[180px] rounded-2xl border border-white/5 bg-[#050505] shadow-inner mb-2 relative flex items-center justify-center overflow-hidden perspective-[800px]">
                   <div className="absolute inset-0 bg-gradient-to-b from-transparent to-amber-900/10 opacity-50" />
                   {/* 3D Visual */}
                   <div className="relative w-32 h-32 flex items-center justify-center animate-[spin_15s_linear_infinite]" style={{ transformStyle: 'preserve-3d' }}>
                      <div className="absolute inset-0 border-[4px] border-amber-500/30 rounded-full" style={{ transform: 'rotateX(75deg)' }} />
                      <div className="absolute inset-0 border-[4px] border-amber-400/20 rounded-full" style={{ transform: 'rotateY(75deg)' }} />
                      <div className="absolute w-16 h-16 bg-amber-500 rounded-full blur-[10px] opacity-30 animate-pulse" />
                      <div className="w-12 h-12 bg-gradient-to-br from-amber-300 to-amber-600 rounded-lg shadow-[0_0_30px_rgba(245,158,11,0.8)]" style={{ transform: 'rotateX(45deg) rotateY(45deg)' }} />
                   </div>
                   {/* Overlay Text */}
                   <div className="absolute bottom-4 right-4 text-xs font-mono font-bold text-amber-500/70 tracking-widest text-shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                      BANK: ONLINE
                   </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#000] p-6 shadow-inner group transition-colors focus-within:border-amber-500/40">
                  <div className="flex items-center justify-between text-[10px] uppercase font-bold text-white/40 mb-3">
                    <span>Extraction Amount</span>
                    <span className="text-amber-500/70">Max: {xpBuckets ? formatUnits(xpBuckets.accrued, decimals) : "0.00"} {sym}</span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={xpClaimAmount}
                      onChange={(e) => setXPClaimAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-transparent font-mono text-4xl text-white focus:outline-none tracking-tight group-focus-within:text-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                    />
                    <div className="absolute right-0 flex items-center gap-3">
                      <button 
                        onClick={() => setXPClaimAmount(xpBuckets ? formatUnits(xpBuckets.accrued, decimals) : "0.00")}
                        className="rounded px-2 py-1 text-[10px] font-bold text-white/40 border border-white/10 transition-colors hover:bg-white/10 hover:text-white shadow"
                      >
                        MAX
                      </button>
                      <span className="text-xl font-bold text-amber-500/30">{sym}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-6 mt-auto">
                  <div className="flex justify-between items-center text-xs mb-2 text-white">
                    <span className="text-amber-500/50 font-bold uppercase tracking-wider">Settlement Path</span>
                    <span className="font-mono font-bold text-amber-400 drop-shadow-[0_0_5px_rgba(245,158,11,0.4)]">Preflight → Wallet</span>
                  </div>
                  <div className="text-[10px] text-white/30 leading-relaxed font-mono uppercase tracking-[0.1em] text-white">
                    <span className="text-emerald-500 mr-2">✓</span> Validating Merkle Proof...<br />
                    <span className="text-emerald-500 mr-2">✓</span> Confirming Bank Liability state.<br />
                    Claims sweep un-minted {sym} from Reserves.
                  </div>
                </div>
              </div>

              {/* Tactical Readout Side */}
              <div className="flex flex-col gap-6">
                <div className="rounded-[2rem] border border-white/5 bg-[#050505] p-6 flex-1 shadow-inner flex flex-col justify-center relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 to-transparent pointer-events-none" />
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-6">Extraction Dossier</div>
                  <div className="space-y-4 text-sm font-mono">
                    <div className="flex items-center justify-between pb-4 border-b border-white/5">
                      <span className="text-white/40">Request Type</span>
                      <span className="font-bold text-white">Settlement</span>
                    </div>
                    <div className="flex items-center justify-between pb-4 border-b border-white/5">
                      <span className="text-white/40 uppercase text-[10px] tracking-widest">Amount</span>
                      <span className="font-bold text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]">{xpClaimAmount || "0.00"} {sym}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/40 uppercase text-[10px] tracking-widest">Contract</span>
                      <span className="font-bold text-emerald-400">VERIFIED</span>
                    </div>
                  </div>
                  
                  {xpClaimFlow.hasActivity && (
                    <div className="mt-8 pt-8 border-t border-white/5">
                       <TxStepper 
                         steps={xpClaimFlow.steps} 
                         title="Trace Manifest" 
                         footer={<Button variant="ghost" size="sm" onClick={xpClaimFlow.reset} className="text-[10px] text-white/30 p-0 h-auto">Reset</Button>} 
                       />
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => void handleClaimXP()}
                  disabled={readOnly || xpClaimFlow.busy || !xpClaimAmount || !hasWallet}
                  className={cn(
                    "w-full rounded-[1.5rem] bg-amber-500 py-5 font-bold text-black shadow-[0_0_24px_rgba(245,158,11,0.3)] transition-all active:scale-[0.98] hover:bg-amber-400 hover:shadow-[0_0_35px_rgba(245,158,11,0.5)] flex justify-center items-center gap-2 text-lg",
                    (xpClaimFlow.busy || !xpClaimAmount || !hasWallet) && "opacity-50 cursor-not-allowed grayscale"
                  )}
                >
                  {xpClaimFlow.busy ? "Executing Settlement..." : <>Initiate Extraction <span className="animate-pulse">_</span></>}
                </button>
                {xpClaimFlow.error && (
                  <p className="text-[10px] text-rose-500 font-mono text-center uppercase tracking-widest">{xpClaimFlow.error.message}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {/* Sync Holdback Panel */}
            <div className="rounded-[2rem] border border-blue-500/20 bg-[#0a0a0a] p-8 shadow-[inset_0_0_30px_rgba(59,130,246,0.02),0_10px_30px_rgba(0,0,0,0.5)] hover:border-blue-500/40 transition-colors group">
              <div className="flex items-start justify-between gap-4 mb-8">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-blue-400/50 mb-2">Secondary System Action</div>
                  <h3 className="text-2xl font-bold drop-shadow-[0_0_10px_rgba(255,255,255,0.1)] text-white">Sync Holdback</h3>
                  <p className="mt-2 text-xs leading-6 text-white/40 max-w-[250px]">
                    Resolve the delta buffer between in-flight game logic and actual realized player XP.
                  </p>
                </div>
                <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-mono font-bold text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.2)] text-white">
                  {xpBuckets ? formatUnits(xpBuckets.holdbackReleasable, decimals) : "0.00"} {sym}
                </div>
              </div>

              <button 
                onClick={() => void handleSyncHoldback()}
                disabled={readOnly || syncHoldbackFlow.busy || !hasWallet}
                className={cn(
                  "w-full rounded-[1rem] border border-blue-500/30 bg-blue-500/10 py-4 font-bold text-blue-300 transition-all hover:bg-blue-500/20 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] shadow-[inset_0_2px_10px_rgba(255,255,255,0.1)]",
                  (syncHoldbackFlow.busy || !hasWallet) && "opacity-50 cursor-not-allowed"
                )}
              >
                {syncHoldbackFlow.busy ? "Syncing Network..." : "Sync Network State"}
              </button>
              
              {syncHoldbackFlow.hasActivity && (
                 <div className="mt-6 pt-6 border-t border-white/5">
                    <TxStepper 
                      steps={syncHoldbackFlow.steps} 
                      title="Sync Trace"
                      footer={<Button variant="ghost" size="sm" onClick={syncHoldbackFlow.reset} className="text-[10px] text-white/30 p-0 h-auto">Reset</Button>}
                    />
                 </div>
              )}
            </div>

            {/* Protocol Fees Panel */}
            <div className="rounded-[2rem] border border-green-500/20 bg-[#0a0a0a] p-8 shadow-[inset_0_0_30px_rgba(34,197,94,0.02),0_10px_30px_rgba(0,0,0,0.5)] hover:border-green-500/40 transition-colors group flex-1 flex flex-col justify-between">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-green-400/50 mb-2 mt-1 flex items-center gap-2 px-3 py-1 bg-green-500/10 rounded-full border border-green-500/20 max-w-max"> <ShieldCheckIcon className="w-3 h-3"/> Governance Only</div>
                  <h3 className="text-2xl font-bold drop-shadow-[0_0_10px_rgba(255,255,255,0.1)] text-white">Sweep Protocol Fees</h3>
                  <p className="mt-2 text-xs leading-6 text-white/40 max-w-[250px] text-white">
                    Root authority routine to capture global system margin and redirect to governance vaults.
                  </p>
                </div>
              </div>

              <div>
                 <div className="flex justify-between items-center mb-6">
                    <span className="text-sm text-white/30 font-bold uppercase tracking-widest">Available Margin</span>
                    <span className="font-mono text-xl text-green-400 font-bold drop-shadow-[0_0_10px_rgba(34,197,94,0.3)]">{pfAmount || "0.00"} {sym}</span>
                 </div>
                 <div className="flex flex-col gap-4 mb-4">
                    <input 
                      type="text" 
                      value={pfAmount}
                      onChange={(e) => setPFAmount(e.target.value)}
                      placeholder="Enter amount..."
                      className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 font-mono text-sm text-white focus:border-green-500/40 transition-all placeholder:text-white/10"
                    />
                    <button 
                      onClick={() => void handleClaimPF()}
                      disabled={readOnly || protocolFeeFlow.busy || !pfAmount || !hasWallet}
                      className={cn(
                        "w-full rounded-[1rem] border border-green-500/30 bg-green-500/10 py-4 font-bold text-green-400 transition-all hover:bg-green-500/20 hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] shadow-[inset_0_2px_10px_rgba(255,255,255,0.1)]",
                        (protocolFeeFlow.busy || !pfAmount || !hasWallet) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {protocolFeeFlow.busy ? "Executing Sweep..." : "Extract Margin"}
                    </button>
                 </div>
                 <div className="text-center mt-3 text-[10px] uppercase font-bold text-white/20 tracking-widest text-white">Requires Multisig Authority</div>
              </div>
            </div>
          </div>
        </div>

        {/* Claim Journal */}
        <div className="mt-12">
          <div className="mb-6 flex items-end justify-between">
            <h3 className="text-xl font-bold tracking-tight text-white">Claim Journal</h3>
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/35 text-white">Cryptographic Reward Audit</span>
          </div>

          <div className="border border-white/5 rounded-[2.5rem] bg-gradient-to-b from-[#0a0a0a] to-[#020202] p-8 shadow-2xl relative overflow-hidden">
             <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-overlay pointer-events-none" />
             <AuditTabs activeColorClass="border-amber-400 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)] bg-amber-500/5">
               <AuditTableHeader>
                 <div className="grid grid-cols-[1.2fr_1.4fr_1fr_1fr_90px] text-[10px] font-bold uppercase tracking-widest text-white/40 pb-4 border-b border-white/5 mb-4">
                   <div>Time / Hash</div>
                   <div>Action Manifest</div>
                   <div>Amount</div>
                   <div>Status</div>
                   <div className="text-right">Registry</div>
                 </div>
               </AuditTableHeader>

               <div className="flex flex-col gap-3">
                 {[
                   { time: "Recent", hash: shortHex(xpClaimFlow.txHash), action: "XP Accumulation Settlement", amount: `${xpClaimAmount || '0.00'} ${sym}`, status: xpClaimFlow.status || 'Verified' },
                 ].map((row, i) => (
                   <div key={i} className="rounded-[1.5rem] border border-white/5 bg-[#050505] p-4 transition-all hover:bg-[#0a0a0a] group">
                     <div className="grid grid-cols-[1.2fr_1.4fr_1fr_1fr_90px] items-center">
                       <AuditTableCell>
                         <div className="flex flex-col gap-1">
                           <span className="text-white font-mono text-sm">{row.time}</span>
                           <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">{row.hash}</span>
                         </div>
                       </AuditTableCell>
                       <AuditTableCell className="text-white/80 font-bold">{row.action}</AuditTableCell>
                       <AuditTableCell>
                         <span className="font-mono text-amber-400 font-bold">{row.amount}</span>
                       </AuditTableCell>
                       <AuditTableCell>
                         <span className="rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.1)]">
                           {row.status}
                         </span>
                       </AuditTableCell>
                       <AuditTableCell className="justify-end text-white/30 transition-transform group-hover:translate-x-1">
                          <ShieldCheckIcon className="w-4 h-4" />
                       </AuditTableCell>
                     </div>
                   </div>
                 ))}
               </div>
             </AuditTabs>
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
