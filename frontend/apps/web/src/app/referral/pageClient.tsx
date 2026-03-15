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
  }

  return (
    <PageTransition pageKey="referral">
      <main className="max-w-[1440px] mx-auto px-6 py-12 md:py-16">
        
        {/* Page Intro */}
        <div className="max-w-3xl mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Affiliate Program</h1>
          <p className="text-white/50 text-lg leading-relaxed">
            Build your network on-chain. Earn a portion of the house edge from every player you invite. 
            No caps, paid instantly.
          </p>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          
          {/* Main Earner Card */}
          <GlassCard glowColor="bg-orange-600/20" padding="lg" className="flex flex-col gap-6 lg:row-span-2 lg:col-span-1 justify-between">
             <div className="flex flex-col gap-2">
                <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Total Earnings</span>
                <span className="text-4xl font-mono font-bold text-transparent bg-clip-text bg-gradient-to-br from-orange-400 to-yellow-600">
                  0.00 USDC
                </span>
                <div className="flex gap-2">
                  <span className="text-orange-400 text-sm font-medium">Auto-distributing to LP</span>
                </div>
             </div>

             <div className="flex flex-col gap-3 p-4 bg-black/50 border border-white/5 rounded-2xl">
                <div className="flex justify-between items-center text-sm">
                   <span className="text-white/50">Current Status</span>
                   <span className="font-mono font-bold text-orange-400">ACTIVE</span>
                </div>
                <button disabled className="w-full py-3 rounded-xl bg-orange-600/50 text-white font-bold cursor-not-allowed">
                  Claim Coming Soon
                </button>
             </div>
          </GlassCard>

          {/* Stats Cards */}
          <GlassCard padding="md" className="flex flex-col gap-2">
             <div className="flex justify-between items-start">
               <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Your Referrer</span>
               <span className="p-2 bg-white/5 rounded-lg text-white/50">🔗</span>
             </div>
             <span className="text-2xl font-mono font-bold mt-2 truncate">
               {hasBoundReferrer ? currentReferrer : "NOT BOUND"}
             </span>
             <span className="text-white/40 text-sm mt-1">{hasBoundReferrer ? "Partner identified" : "No binding found"}</span>
          </GlassCard>

          <GlassCard padding="md" className="flex flex-col gap-2">
             <div className="flex justify-between items-start">
               <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Protocol Edge</span>
               <span className="p-2 bg-white/5 rounded-lg text-white/50">⚖️</span>
             </div>
             <span className="text-3xl font-mono font-bold mt-2">3.5%</span>
             <span className="text-white/40 text-sm mt-1">Base house edge</span>
          </GlassCard>

          {/* Bind / Invite Link Card */}
          <GlassCard padding="lg" className="flex flex-col gap-6 lg:col-span-2 border-orange-500/20 shadow-[0_0_40px_rgba(234,88,12,0.05)]">
             {!hasBoundReferrer ? (
               <>
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="text-xl font-bold mb-1">Bind Your Referrer</h3>
                      <p className="text-sm text-white/50">One-time cryptographic action to join a network.</p>
                    </div>
                    <TxStatusChip status={bindFlow.status} />
                 </div>

                 <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    <input
                      type="text"
                      placeholder="0x... referrer address"
                      value={referrerInput}
                      onChange={(e) => setReferrerInput(e.target.value)}
                      disabled={readOnly || bindFlow.busy}
                      className="flex-1 bg-[#050505] border border-white/10 rounded-xl px-4 py-3 font-mono text-sm outline-none focus:border-orange-500/50 transition-colors text-white"
                    />
                    <Button 
                      onClick={() => void handleBind()}
                      disabled={readOnly || bindFlow.busy || !referrerInput.trim()}
                      className="px-8 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold transition-transform active:scale-95"
                    >
                      {bindFlow.busy ? "Binding..." : "Confirm Bind"}
                    </Button>
                 </div>
                 {formError && <p className="text-xs text-rose-500">{formError}</p>}
                 {bindFlow.hasActivity && (
                   <div className="mt-4 pt-4 border-t border-white/5">
                      <TxStepper steps={bindFlow.steps} title="Bind Trace" footer={<Button variant="ghost" size="sm" onClick={bindFlow.reset} className="text-[10px] text-white/30 p-0 h-auto">Reset</Button>} />
                   </div>
                 )}
               </>
             ) : (
               <>
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="text-xl font-bold mb-1">Your Referral Link</h3>
                      <p className="text-sm text-white/50">Invite players to earn a portion of their house edge.</p>
                    </div>
                 </div>

                 <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    <div className="flex-1 flex items-center bg-[#050505] border border-white/10 rounded-xl px-4 py-3 font-mono text-sm overflow-hidden select-all text-white/70">
                       {typeof window !== 'undefined' ? `${window.location.origin}/?ref=${sdk?.account || '0x...'}` : 'Loading...'}
                    </div>
                    <CopyButton 
                       value={typeof window !== 'undefined' ? `${window.location.origin}/?ref=${sdk?.account || ''}` : ''} 
                       className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white hover:bg-gray-200 text-black font-bold flex items-center justify-center gap-2 transition-transform active:scale-95" 
                    />
                 </div>
               </>
             )}
          </GlassCard>
        </div>

        {/* Network Activity Table Placeholder */}
        <div>
           <div className="flex justify-between items-end mb-6">
              <h3 className="text-xl font-bold tracking-tight">Recent Network Activity</h3>
           </div>
           
           <AuditTabs activeColorClass="border-orange-400 text-orange-400">
             <AuditTableHeader>
                <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_80px] text-white/40 font-bold uppercase tracking-wider text-[10px]">
                  <div>Time / Block</div>
                  <div>Event</div>
                  <div>Volume</div>
                  <div>Rewards</div>
                  <div className="text-right">Chain</div>
                </div>
             </AuditTableHeader>

             <div className="py-20 text-center flex flex-col items-center gap-4 border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-xl grayscale opacity-50">📊</div>
                <div className="flex flex-col gap-1">
                  <div className="text-white font-medium text-sm">Tracking network deployment...</div>
                  <div className="text-white/30 text-xs text-balance max-w-xs">Live affiliate tracking is syncing with the protocol indexer. Activity will appear here shortly.</div>
                </div>
             </div>
           </AuditTabs>
        </div>

      </main>
    </PageTransition>
  );
}
