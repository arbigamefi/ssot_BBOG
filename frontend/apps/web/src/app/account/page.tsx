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
  GlassCard,
  AuditTabs,
  AuditTableHeader,
  AuditTableRow,
  AuditTableCell,
  cn,
  type DataTableColumn,
  toast,
  CyberButton,
  StatBlock,
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

  const primaryAsset = release?.assets[0];
  const totalAssetsEquivalent = assetRows.reduce((sum, row) => sum + row.assetsEquivalent, 0n);
  return (
    <PageTransition pageKey="account">
       {/* Global Indigo Ambience */}
       <div className="fixed top-0 left-0 w-[600px] h-[600px] bg-indigo-900/10 blur-[150px] pointer-events-none rounded-full z-0" />
       
      <main className="relative z-10 max-w-[1440px] mx-auto px-6 py-12 md:py-16 flex flex-col gap-12">
        
        {/* Account Header Section */}
        <div className="flex flex-col md:flex-row gap-8 justify-between items-start md:items-end mb-4">
          <div className="flex items-center gap-6">
            <div className="relative w-28 h-28 group cursor-pointer perspective-1000">
               <div className="absolute inset-0 bg-indigo-500/10 blur-[20px] rounded-full group-hover:bg-indigo-500/30 transition-all duration-500" />
               <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 group-hover:border-indigo-400 group-hover:animate-[spin_4s_linear_infinite] transition-all" />
               
               <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#0a0a0a] to-[#111] rounded-full shadow-[inset_0_2px_15px_rgba(99,102,241,0.2)] border border-indigo-500/30 z-10 group-hover:scale-105 transition-transform duration-500">
                  <span className="text-4xl drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]">👤</span>
               </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="text-indigo-400 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                 <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" /> Encrypted Identity
              </div>
              <h1 className="text-4xl md:text-5xl font-mono font-extrabold tracking-tight text-white flex items-center gap-3 drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                {account ? shortHex(account) : "No Wallet"}
                {account && <CopyButton value={account} className="bg-white/5 border-white/10" />}
              </h1>
              <div className="flex items-center gap-3 text-sm text-white/50 font-medium font-mono">
                 <span>Chain ID: {chainId}</span>
                 <span className="text-white/20">•</span>
                 {explorerBaseUrl && account && (
                   <a href={`${explorerBaseUrl}/address/${account}`} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300 transition-colors">Arbiscan ↗</a>
                 )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             {!account ? <ConnectWalletPrompt action="authenticate" /> : (
               <button className="px-8 py-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-black font-bold text-sm shadow-[0_0_30px_rgba(99,102,241,0.2)] transition-all active:scale-95">
                  Authenticated Session
               </button>
             )}
          </div>
        </div>

        {/* Global Balances - Cyber Terminal Style */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
           {/* Total Value Vault */}
           <div className="p-8 rounded-[2rem] border-2 border-indigo-500/20 bg-gradient-to-br from-indigo-950/20 to-[#050505] shadow-[inset_0_0_40px_rgba(99,102,241,0.05),0_10px_40px_rgba(0,0,0,0.5)] flex flex-col justify-center relative overflow-hidden group hover:border-indigo-500/40 transition-colors">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-500/10 blur-[50px] rounded-full group-hover:bg-indigo-500/20 transition-all" />
              <span className="text-indigo-300/50 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 mb-2">
                 <div className="w-2 h-2 rounded-sm bg-indigo-500/50" /> Vault Valuation
              </span>
              <span className="text-3xl md:text-4xl font-mono font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-indigo-200 drop-shadow-[0_0_20px_rgba(99,102,241,0.3)] mb-2">
                 {primaryAsset ? formatAmount(totalAssetsEquivalent, primaryAsset.decimals, primaryAsset.symbol) : "$0.00"}
              </span>
              <span className="text-indigo-400 max-w-[200px] text-[10px] font-medium leading-relaxed font-mono uppercase tracking-tighter">Secured via SSOT SDK v1.02</span>
           </div>

           {/* Asset Breakdown Terminal */}
           <div className="p-8 rounded-[2rem] border border-white/5 bg-[#0a0a0a] shadow-[inset_0_0_40px_rgba(255,255,255,0.02),0_10px_40px_rgba(0,0,0,0.5)] flex flex-col justify-between col-span-1 lg:col-span-3 relative overflow-hidden group hover:border-white/10 transition-colors">
              <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-6">Asset Breakdown</span>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                 {assetRows.length > 0 ? assetRows.map((row, i) => (
                    <div key={row.id} className={cn("flex flex-col group/item", i > 0 && "md:border-l border-white/5 md:pl-8")}>
                       <div className="flex items-center gap-2 mb-2">
                          <span className={cn("w-3 h-3 rounded shadow-[0_0_10px_rgba(255,255,255,0.5)]", i === 1 ? "bg-blue-500" : i === 2 ? "bg-amber-500" : "bg-white")} />
                          <span className={cn("font-mono text-3xl font-bold group-hover/item:text-shadow-[0_0_20px_rgba(255,255,255,0.5)] transition-all", i === 1 ? "text-blue-400" : i === 2 ? "text-amber-500" : "text-white")}>
                             {formatAmount(row.assetsEquivalent, row.decimals)}
                          </span>
                       </div>
                       <span className="text-xs font-bold uppercase tracking-widest text-white/40 mb-1">{row.symbol}</span>
                       <span className="text-white/30 text-[10px] font-mono tracking-tighter uppercase">{i === 1 ? "Providing Liquidity" : i === 2 ? "Protocol Rewards" : "Available Balance"}</span>
                    </div>
                 )) : (
                    <div className="col-span-3 py-4 text-center text-white/20 text-xs font-mono uppercase tracking-[0.2em]">Indexing local wallet context...</div>
                 )}
              </div>
           </div>
        </div>

        {/* Audit / Journal Section */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-12">
           <div className="flex flex-col gap-6">
              <div className="flex justify-between items-end mb-2">
                 <div>
                    <h2 className="text-2xl font-bold tracking-tight mb-1">Transaction Journal</h2>
                    <p className="text-white/50 text-sm">On-chain actions mapped to your wallet context.</p>
                 </div>
              </div>
              
              <AuditTabs activeColorClass="border-indigo-400 text-indigo-400">
                <AuditTableHeader>
                   <div className="grid grid-cols-[1.5fr_2fr_1.5fr_1fr_80px] text-white/40 font-bold uppercase tracking-wider text-[10px]">
                     <div>Time / Hash</div>
                     <div>Event / Module</div>
                     <div>Amount</div>
                     <div>Status</div>
                     <div className="text-right">Chain</div>
                   </div>
                </AuditTableHeader>
                
                <div className="min-h-[400px]">
                   {txRows.length > 0 ? txRows.map((tx: any, i: number) => (
                      <AuditTableRow key={i}>
                        <div className="grid grid-cols-[1.5fr_2fr_1.5fr_1fr_80px] items-center">
                          <AuditTableCell>
                            <div className="flex flex-col gap-1">
                              <span className="text-white text-xs">{new Date(tx.createdAt).toLocaleString()}</span>
                              <span className="text-[10px] font-mono text-indigo-400/50 hover:text-indigo-300 transition-colors cursor-pointer">{shortHex(tx.txHash)}</span>
                            </div>
                          </AuditTableCell>
                          <AuditTableCell>
                            <div className="flex flex-col gap-1">
                              <span className="text-white font-bold text-xs uppercase tracking-tight">{tx.action.replace(/_/g, ' ')}</span>
                              <span className="text-[10px] text-white/30 font-mono">SSOT Protocol Engine</span>
                            </div>
                          </AuditTableCell>
                          <AuditTableCell>
                            <span className="font-mono font-bold text-xs text-white/60">
                               —
                            </span>
                          </AuditTableCell>
                          <AuditTableCell>
                             <TxStatusChip status={tx.status} />
                          </AuditTableCell>
                          <AuditTableCell className="justify-end transition-transform hover:translate-x-1 cursor-pointer text-white/30 hover:text-white">
                            ↗
                          </AuditTableCell>
                        </div>
                      </AuditTableRow>
                   )) : (
                     <div className="py-20 text-center flex flex-col items-center gap-4 border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
                        <span className="text-white/20 text-xs font-mono uppercase tracking-[0.2em]">Journal is empty for this session</span>
                     </div>
                   )}
                </div>
              </AuditTabs>
           </div>

           {/* Sidebar: Allowances & Refunds */}
           <div className="flex flex-col gap-10">
              <div className="flex flex-col gap-6">
                 <h2 className="text-lg font-bold tracking-tight uppercase tracking-[0.2em] text-white/40">Bank Protections</h2>
                 <div className="flex flex-col gap-4">
                    {assetRows.map((row) => (
                       <div key={row.id} className="p-5 rounded-2xl border border-white/5 bg-[#0a0a0a] flex justify-between items-center group hover:border-indigo-500/30 transition-all">
                          <div className="flex flex-col">
                             <span className="text-sm font-bold text-white uppercase tracking-tight">{row.symbol} Allowance</span>
                             <span className="text-[10px] text-white/30 font-mono">Bank Spender Approval</span>
                          </div>
                          <span className={cn("font-mono text-xs font-bold px-3 py-1 rounded-lg border", row.allowance === 0n ? "text-rose-400 border-rose-400/20 bg-rose-400/5" : "text-emerald-400 border-emerald-400/20 bg-emerald-400/5")}>
                             {row.allowance > 1_000_000_000_000_000_000n ? "UNLIMITED" : formatAmount(row.allowance, row.decimals)}
                          </span>
                       </div>
                    ))}
                    {assetRows.length === 0 && <span className="text-white/20 text-xs font-mono italic text-center py-4 bg-white/5 rounded-xl border border-dashed border-white/10">No active assets found.</span>}
                 </div>
              </div>

              <div className="flex flex-col gap-6">
                  <h2 className="text-lg font-bold tracking-tight uppercase tracking-[0.2em] text-white/40">Recovery Services</h2>
                  <div className="p-8 rounded-[2rem] border-2 border-indigo-500/20 bg-indigo-500/[0.03] shadow-[inset_0_0_40px_rgba(99,102,241,0.02)] flex flex-col gap-6 relative overflow-hidden group">
                     <div>
                        <div className="flex items-center justify-between mb-3 text-[10px] font-bold uppercase tracking-widest text-indigo-400/50">
                           <span>VRF Refund Credit</span>
                           <TxStatusChip status={claimRefundFlow.status} />
                        </div>
                        <div className="text-4xl font-mono font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 to-purple-500 drop-shadow-[0_0_20px_rgba(99,102,241,0.3)]">
                           {primaryAsset && account ? formatAmount(refundCredit, primaryAsset.decimals, primaryAsset.symbol) : "0.00"}
                        </div>
                     </div>

                     <p className="text-[11px] text-white/40 font-mono tracking-tighter leading-relaxed">
                        Credit recovered from failed/cancelled VRF requests. Reclaiming moves assets to your house position.
                     </p>

                     {claimRefundFlow.error && <ErrorCallout title="Tx Error" message={claimRefundFlow.error.message} />}

                     <button 
                        onClick={() => void handleClaimRefund()}
                        disabled={!account || readOnly || claimRefundFlow.busy || refundCredit === 0n}
                        className="w-full py-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-black font-extrabold text-sm transition-all shadow-[0_0_20px_rgba(99,102,241,0.2)] disabled:opacity-30 disabled:grayscale disabled:shadow-none active:scale-[0.98]"
                     >
                        {claimRefundFlow.busy ? "Executing Claim..." : "Claim Recovery Credit"}
                     </button>

                     {claimRefundFlow.hasActivity && (
                       <div className="mt-4 pt-6 border-t border-white/5">
                          <TxStepper 
                             title="Claim Manifest" 
                             steps={claimRefundFlow.steps} 
                             footer={<button onClick={claimRefundFlow.reset} className="text-[9px] font-bold uppercase tracking-widest text-white/20 hover:text-white transition-colors">Reset Trace</button>}
                          />
                       </div>
                     )}
                  </div>

                  <div className="p-6 rounded-[2rem] border border-white/5 bg-[#050505] flex flex-col gap-4">
                     <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">Protocol Context</span>
                     <div className="flex justify-between items-center">
                        <span className="text-xs text-white/40">Release Digest</span>
                        <span className="text-[10px] font-mono text-indigo-300 bg-indigo-300/10 px-2 py-1 rounded-md">{shortHex(release?.releaseDigest)}</span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-xs text-white/40">Session Mode</span>
                        <span className={cn("text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md", readOnly ? "text-amber-400 bg-amber-400/10" : "text-emerald-400 bg-emerald-400/10")}>{readOnly ? "READ ONLY" : "WRITABLE"}</span>
                     </div>
                  </div>
              </div>
           </div>
        </div>

      </main>
    </PageTransition>
  );
}
