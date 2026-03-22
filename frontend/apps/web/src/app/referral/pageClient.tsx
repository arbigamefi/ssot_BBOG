"use client";

import * as React from "react";
type Address = `0x${string}`;

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CopyButton,
  ErrorCallout,
  Input,
  Label,
  PageHeader,
  TxStatusChip,
  TxStepper,
  toast,
  GlassCard,
  AuditTabs,
  AuditTableHeader,
  StatBlock,
  CyberButton,
} from "@ssot/ui";

import { PageTransition } from "../../components/PageTransition";
import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../ssot/sdk";
import { ConnectWalletPrompt } from "../../components/ConnectWalletPrompt";
import { useDirectTxAction } from "../../features/tx/useDirectTxAction";

function shortHex(s?: string) {
  if (!s) return "—";
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

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

export function ReferralPageClient() {
  const { release, readOnly, readOnlyReason, chainId } = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const explorerBaseUrl = React.useMemo(() => getExplorerBaseUrl(chainId), [chainId]);

  const [currentReferrer, setCurrentReferrer] = React.useState<Address | null>(null);
  const [loadError, setLoadError] = React.useState<string | undefined>();
  const [loading, setLoading] = React.useState(false);

  const [referrerInput, setReferrerInput] = React.useState("");
  const [formError, setFormError] = React.useState<string | undefined>();

  const bindFlow = useDirectTxAction({
    action: "BIND_REFERRER",
    labels: {
      preflight: "Preflight",
      submit: "Submit bind",
      confirm: "Confirm on-chain",
    },
    descriptions: {
      preflight: "Validate the address and simulate Hub.bindReferrer().",
      submit: "Broadcast the bindReferrer transaction through the wallet client.",
      confirm: "Wait for receipt and journal reconciliation.",
    },
  });

  const hasBoundReferrer = currentReferrer != null && currentReferrer !== ZERO_ADDRESS;

  const fetchReferrer = React.useCallback(async () => {
    if (!sdk || !ready || !sdk.account) return;
    setLoading(true);
    setLoadError(undefined);
    try {
      const ref = await sdk.hub.referrerOf(sdk.account);
      setCurrentReferrer(ref as Address);
    } catch (e) {
      setLoadError((e as Error)?.message ?? "Failed to fetch referrer");
    } finally {
      setLoading(false);
    }
  }, [sdk, ready]);

  React.useEffect(() => {
    void fetchReferrer();
  }, [fetchReferrer]);

  const handleBind = React.useCallback(async () => {
    if (!sdk || !sdk.account || readOnly) return;
    setFormError(undefined);
    const trimmed = referrerInput.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      setFormError("Please enter a valid Ethereum address (0x...)");
      return;
    }
    const addr = trimmed as Address;
    if (addr.toLowerCase() === sdk.account.toLowerCase()) {
      setFormError("Cannot set yourself as your own referrer");
      return;
    }
    if (addr === ZERO_ADDRESS) {
      setFormError("Cannot bind to zero address");
      return;
    }
    try {
      const res = await bindFlow.execute(() => sdk.hub.bindReferrer(addr));
      if (!res.ok) {
        return;
      }
      toast.success("Referrer bound successfully", {
        description: `Your referrer is now ${addr.slice(0, 6)}...${addr.slice(-4)}`,
      });
      setReferrerInput("");
      void fetchReferrer();
    } catch (e) {
      toast.error((e as Error)?.message ?? "Transaction failed");
    }
  }, [bindFlow, fetchReferrer, readOnly, referrerInput, sdk]);

  if (!release) {
    return (
      <PageTransition pageKey="referral">
        <PageHeader title="Referral" description={readOnlyReason ?? "No embedded release available."} />
      </PageTransition>
    );
  }  return (
    <PageTransition pageKey="referral">
      {/* Global Background Ambience - Purple */}
      <div className="fixed top-0 right-0 w-[800px] h-[600px] bg-purple-900/10 blur-[150px] pointer-events-none rounded-full z-0" />
      <div className="fixed bottom-0 left-0 w-[600px] h-[500px] bg-blue-900/10 blur-[120px] pointer-events-none rounded-full z-0" />

      <main className="relative z-10 max-w-[1440px] mx-auto px-6 py-12 md:py-16">
        
        {/* LOBBY HEADER */}
        <header className="mb-14 flex flex-col md:flex-row md:items-end justify-between gap-8">
           <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-bold uppercase tracking-widest mb-6">
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" /> Zero-Reconciliation Engine
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-400">
                 Distribute & Earn On-Chain
              </h1>
              <p className="text-lg text-white/50 leading-relaxed">
                 Traditional platforms rely on manual spreadsheets and delayed payouts. ArbiGameFi's SSOT architecture splits marketing budgets at the exact block a bet is settled. Fully transparent, instantly claimable.
              </p>
           </div>
           
           <div className="flex gap-4">
              {!sdk?.account ? (
                 <ConnectWalletPrompt action="generate link" />
              ) : (
                 <button className="px-6 py-3 rounded-xl bg-purple-500 hover:bg-purple-400 text-black font-bold shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-colors flex items-center gap-2">
                    Active Link <span className="w-2 h-2 rounded-full bg-black/40 animate-pulse" />
                 </button>
              )}
           </div>
        </header>

        {/* METRICS DASHBOARD - Cyber Terminal Style */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
           <div className="p-8 rounded-[2rem] border-2 border-purple-500/20 bg-gradient-to-br from-[#0c051a] to-[#050505] shadow-[inset_0_0_40px_rgba(168,85,247,0.05),0_10px_40px_rgba(0,0,0,0.5)] relative overflow-hidden group hover:border-purple-500/40 transition-colors">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500/10 blur-[50px] rounded-full group-hover:bg-purple-500/20 transition-all" />
              <div className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-2 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-purple-500/50" /> Total Earned (USDC)</div>
              <div className="text-3xl lg:text-4xl font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-purple-200 drop-shadow-[0_0_15px_rgba(168,85,247,0.3)] flex items-center justify-between">
                 $0.00
                 <span className="text-xs text-white/20 font-sans tracking-normal font-medium">Auto-Staked</span>
              </div>
           </div>

           <div className="p-8 rounded-[2rem] border border-white/5 bg-[#0a0a0a] shadow-[inset_0_0_40px_rgba(255,255,255,0.02),0_10px_40px_rgba(0,0,0,0.5)] group hover:border-fuchsia-500/30 transition-colors">
              <div className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-2">Active Organics</div>
              <div className="text-3xl lg:text-4xl font-mono font-bold text-white flex items-end gap-2 group-hover:text-shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all">
                 0 <span className="text-sm text-white/30 font-sans font-medium mb-1">wallets</span>
              </div>
           </div>

           <div className="p-8 rounded-[2rem] border border-white/5 bg-[#0a0a0a] shadow-[inset_0_0_40px_rgba(255,255,255,0.02),0_10px_40px_rgba(0,0,0,0.5)] group hover:border-blue-500/30 transition-colors">
              <div className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-2">Network Volume</div>
              <div className="text-3xl lg:text-4xl font-mono font-bold text-white group-hover:text-shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all">
                 $0.00
              </div>
           </div>

           <div className="p-8 rounded-[2rem] border-2 border-emerald-500/10 bg-[#050510] shadow-[inset_0_0_40px_rgba(16,185,129,0.02),0_10px_40px_rgba(0,0,0,0.5)] group hover:border-emerald-500/40 transition-colors">
              <div className="text-[10px] uppercase font-bold text-emerald-400/50 tracking-widest mb-2">Your Referrer</div>
              <div className="flex justify-between items-end">
                 <div className="text-3xl lg:text-4xl font-mono font-extrabold text-emerald-400 drop-shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                    {hasBoundReferrer ? shortHex(currentReferrer as string) : "None"}
                 </div>
              </div>
           </div>
        </div>

        {/* ARCHITECTURE & LINKS */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8">
           
           {/* Left: 3D Holographic Network Tree */}
           <div className="rounded-[2.5rem] border border-white/5 bg-gradient-to-br from-[#080311] to-[#040208] p-8 relative overflow-hidden h-[500px] flex flex-col shadow-[inset_0_2px_40px_rgba(0,0,0,0.8)]">
              <div className="flex justify-between items-center mb-8 relative z-10">
                 <div>
                    <h3 className="text-2xl font-bold mb-1">Skyline Isometric Map</h3>
                    <p className="text-sm text-white/40">Visualizing your on-chain downline and rebate splits in realtime.</p>
                 </div>
                 <div className="px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 text-sm font-mono flex items-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.2)] backdrop-blur-md">
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-[pulse_1s_infinite]" /> LIVE
                 </div>
              </div>

              {/* Advanced 3D Abstract Tree Visual */}
              <div className="flex-1 relative flex items-center justify-center">
                 <div className="relative w-full h-full flex items-center justify-center opacity-40 scale-75 lg:scale-100" style={{ perspective: '1200px' }}>
                    <div className="relative w-[300px] h-[300px] flex items-center justify-center" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(60deg) rotateZ(-30deg)' }}>
                       {/* Center Node (You) */}
                       <div className="absolute w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/80 to-fuchsia-600/80 border-2 border-purple-300 z-30 flex items-center justify-center shadow-[0_0_50px_rgba(168,85,247,0.8)] animate-[bounce_4s_ease-in-out_infinite]">
                          <span className="font-extrabold text-xs" style={{ transform: 'rotateX(-60deg) rotateZ(30deg)' }}>YOU</span>
                       </div>
                       {/* Holographic Rings */}
                       <div className="absolute w-[200px] h-[200px] rounded-full border-[1px] border-purple-500/30 z-10 animate-[spin_10s_linear_infinite]" />
                       <div className="absolute w-[400px] h-[400px] rounded-full border-[1px] border-fuchsia-500/20 border-dashed z-10 animate-[spin_20s_linear_infinite_reverse]" />
                    </div>
                 </div>
              </div>
           </div>

           {/* Right: Link Generation & Settings */}
           <div className="flex flex-col gap-6">
              
              {/* Master Protocol Link generator */}
              <div className="rounded-[2.5rem] border-2 border-purple-500/20 bg-gradient-to-br from-purple-950/20 to-[#050505] p-8 flex flex-col relative overflow-hidden group shadow-[inset_0_2px_20px_rgba(168,85,247,0.05)]">
                 <h3 className="text-xl font-bold mb-6 text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">Master Protocol Link</h3>
                 
                 {!sdk?.account ? (
                    <div className="py-4">
                       <ConnectWalletPrompt action="generate link" />
                    </div>
                 ) : (
                    <>
                       <div className="bg-[#050505] border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4 mb-6 relative z-10 group/copy cursor-pointer">
                          <span className="font-mono text-sm text-purple-100 truncate">
                             {typeof window !== 'undefined' ? `${window.location.host}/?ref=${shortHex(sdk.account)}` : 'arbigamefi.io/ref/...'}
                          </span>
                          <CopyButton 
                            value={typeof window !== 'undefined' ? `${window.location.origin}/?ref=${sdk.account}` : ''}
                            className="bg-purple-500/20 border border-purple-500/30 text-purple-300"
                          />
                       </div>

                       <div className="flex items-center justify-between text-sm mb-6 bg-white/[0.02] border border-white/5 rounded-xl p-4">
                          <span className="text-white/40 uppercase tracking-widest text-[10px] font-bold">Incentive Path</span>
                          <span className="font-mono text-emerald-400 font-bold">10% Rebate Split</span>
                       </div>
                    </>
                 )}
              </div>

              {/* Bind Referrer Section */}
              {!hasBoundReferrer && sdk?.account && (
                 <div className="rounded-[2.5rem] border border-white/5 bg-[#0a0a0a] p-8 flex-1 flex flex-col shadow-xl">
                    <h3 className="text-lg font-bold mb-4">Bind Referrer</h3>
                    <p className="text-xs text-white/40 mb-6">Enter the wallet address that referred you to finalize on-chain rewards split.</p>
                    
                    <div className="flex flex-col gap-4">
                       <input
                         type="text"
                         placeholder="0x... address"
                         value={referrerInput}
                         onChange={(e) => setReferrerInput(e.target.value)}
                         disabled={readOnly || bindFlow.busy}
                         className="bg-[#050505] border border-white/10 rounded-xl px-4 py-3 font-mono text-sm outline-none focus:border-purple-500/50 transition-colors text-white"
                       />
                       {formError && <p className="text-[10px] text-rose-500">{formError}</p>}
                       <button 
                         onClick={() => void handleBind()}
                         disabled={readOnly || bindFlow.busy || !referrerInput.trim()}
                         className="w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all active:scale-[0.98]"
                       >
                          {bindFlow.busy ? "Binding..." : "Confirm Binding"}
                       </button>
                    </div>

                    {bindFlow.hasActivity && (
                       <div className="mt-6 pt-6 border-t border-white/5">
                          <TxStatusChip status={bindFlow.status} />
                          <div className="mt-4">
                             <TxStepper steps={bindFlow.steps} title="Bind Trace" />
                          </div>
                       </div>
                    )}
                 </div>
              )}

              {/* Table Preview */}
              {hasBoundReferrer && (
                 <div className="rounded-[2.5rem] border border-white/5 bg-[#0a0a0a] p-8 flex-1 flex flex-col shadow-xl">
                    <h3 className="text-lg font-bold mb-6">Recent Network Activity</h3>
                    <div className="flex-1 flex flex-col gap-3 py-10 text-center border border-dashed border-white/5 rounded-2xl">
                       <span className="text-xs text-white/20 uppercase tracking-widest">Awaiting active downline...</span>
                    </div>
                 </div>
              )}
           </div>
        </div>
      </main>
    </PageTransition>
  );
}
