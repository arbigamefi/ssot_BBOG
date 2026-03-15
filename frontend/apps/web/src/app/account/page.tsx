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
      <main className="max-w-[1440px] mx-auto px-6 py-12 md:py-16 flex flex-col gap-12">
        
        {/* Account Header Section */}
        <div className="flex flex-col md:flex-row gap-8 justify-between items-start md:items-end">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-indigo-500/20 border-2 border-indigo-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.2)]">
               <span className="text-3xl">👤</span>
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl md:text-5xl font-mono font-bold tracking-tight text-white flex items-center gap-3">
                {account ? shortHex(account) : "No Wallet"}
                {account && <CopyButton value={account} label="Copy address" />}
              </h1>
              <div className="flex items-center gap-3 text-sm text-white/50">
                 <span>Chain ID: {chainId}</span>
                 <span>•</span>
                 {explorerBaseUrl && account && (
                   <a href={`${explorerBaseUrl}/address/${account}`} target="_blank" rel="noreferrer" className="text-green-400 hover:text-green-300 transition-colors">Explorer ↗</a>
                 )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
             {!account && <ConnectWalletPrompt action="inspect account" />}
             {account && (
               <button className="px-6 py-3 rounded-full bg-white text-black font-bold text-sm hover:bg-gray-200 transition-colors">Connected</button>
             )}
          </div>
        </div>

        {balancesError && <ErrorCallout title="Load error" message={(balancesError as Error).message} />}

        {/* Global Balances */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           <GlassCard glowColor="bg-indigo-500/20" padding="md" className="flex flex-col gap-2 relative">
              <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Total Vault Value</span>
              <span className="text-3xl font-mono font-bold">
                {primaryAsset ? formatAmount(totalAssetsEquivalent, primaryAsset.decimals, primaryAsset.symbol) : "—"}
              </span>
              <span className="text-indigo-400 text-sm font-medium">Sum of all bank shares</span>
           </GlassCard>

           <GlassCard padding="md" className="flex flex-col gap-2 justify-between col-span-1 md:col-span-3">
              <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Asset Breakdown</span>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                 {assetRows.length > 0 ? assetRows.map((row, i) => (
                   <div key={row.id} className={cn("flex flex-col", i > 0 && "border-l border-white/10 pl-8")}>
                      <span className={cn("font-mono text-2xl font-bold", i === 1 ? "text-blue-400" : i === 2 ? "text-amber-500" : "text-white")}>
                        {formatAmount(row.assetsEquivalent, row.decimals, row.symbol)}
                      </span>
                      <span className="text-white/40 text-sm mt-1">{i === 1 ? "Providing Liquidity" : i === 2 ? "Unclaimed Rewards" : "Ready to play"}</span>
                   </div>
                 )) : (
                   <div className="text-white/20 text-sm italic">No assets identified in this release.</div>
                 )}
              </div>
           </GlassCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-12">
           {/* Transaction Journal */}
           <div className="flex flex-col gap-6">
              <h2 className="text-2xl font-bold tracking-tight">Transaction Journal</h2>
              
              <AuditTabs activeColorClass="border-indigo-400 text-indigo-400">
                <AuditTableHeader>
                   <div className="grid grid-cols-[1fr_2fr_1fr_1fr_80px] text-white/40 font-bold uppercase tracking-wider text-[10px]">
                     <div>Date / Hash</div>
                     <div>Event Type / Action</div>
                     <div>Amount</div>
                     <div>Status</div>
                     <div className="text-right">Chain</div>
                   </div>
                </AuditTableHeader>
                
                {txRows.length > 0 ? txRows.map((tx: any, i: number) => (
                   <AuditTableRow key={i}>
                     <div className="grid grid-cols-[1fr_2fr_1fr_1fr_80px] items-center">
                       <AuditTableCell>
                         <div className="flex flex-col gap-1">
                           <span className="text-white">{new Date(tx.createdAt).toLocaleDateString()}</span>
                           <span className="text-xs font-mono text-white/30 hover:text-white transition-colors cursor-pointer">{shortHex(tx.txHash)}</span>
                         </div>
                       </AuditTableCell>
                       <AuditTableCell>
                         <div className="flex flex-col gap-1">
                           <span className="text-white font-medium">{tx.action}</span>
                           <span className="text-xs text-white/40">Chain {tx.chainId}</span>
                         </div>
                       </AuditTableCell>
                       <AuditTableCell>
                         <span className="font-mono font-bold text-sm text-white/60">
                            —
                         </span>
                       </AuditTableCell>
                       <AuditTableCell>
                         <span className={cn("py-1 px-3 rounded-md border font-mono text-[10px] uppercase font-bold tracking-widest", 
                           tx.status === 'mined' ? "bg-green-500/10 border-green-500/20 text-green-400" : 
                           tx.status === 'failed' ? "bg-red-500/10 border-red-500/20 text-red-400" :
                           "bg-blue-500/10 border-blue-500/20 text-blue-400")}>
                           {tx.status}
                         </span>
                       </AuditTableCell>
                       <AuditTableCell className="justify-end transition-transform hover:translate-x-1 cursor-pointer text-white/30 hover:text-white">
                         ↗
                       </AuditTableCell>
                     </div>
                   </AuditTableRow>
                )) : (
                  <div className="py-12 text-center text-white/30 font-mono text-sm border-b border-white/5">No transactions in local journal.</div>
                )}
              </AuditTabs>
           </div>

           {/* Sidebar: Allowances & Refunds */}
           <div className="flex flex-col gap-12">
              <div className="flex flex-col gap-6">
                 <h2 className="text-2xl font-bold tracking-tight">Allowances / Bank</h2>
                 <GlassCard padding="lg" className="flex flex-col gap-4 border-white/5">
                    <div className="flex flex-col gap-4">
                       {assetRows.map((row) => (
                          <div key={row.id} className="flex justify-between items-center border-b border-white/5 pb-3 last:border-0 last:pb-0">
                             <div className="flex flex-col">
                                <span className="text-sm font-bold text-white">{row.symbol}</span>
                                <span className="text-[10px] text-white/30 uppercase tracking-widest">Bank Spender</span>
                             </div>
                             <span className={cn("font-mono text-xs font-bold", row.allowance === 0n ? "text-rose-500" : "text-emerald-400")}>
                                {row.allowance > 1_000_000_000_000_000_000n ? "Unlimited" : formatAmount(row.allowance, row.decimals)}
                             </span>
                          </div>
                       ))}
                       {assetRows.length === 0 && <span className="text-white/20 text-xs text-center py-4 italic">No assets identified.</span>}
                    </div>
                 </GlassCard>
              </div>

              <div className="flex flex-col gap-6">
                  <h2 className="text-2xl font-bold tracking-tight">Refund logic</h2>
                  <GlassCard padding="lg" className="flex flex-col gap-6 border-indigo-500/20 bg-indigo-500/[0.02]">
                     <div>
                        <div className="flex items-center justify-between mb-2">
                           <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">VRF Refund Credit</span>
                           <TxStatusChip status={claimRefundFlow.status} />
                        </div>
                        <div className="text-3xl font-mono font-bold text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 to-purple-500">
                           {primaryAsset && account ? formatAmount(refundCredit, primaryAsset.decimals, primaryAsset.symbol) : "0.00"}
                        </div>
                     </div>

                     <div className="p-4 bg-black/40 border border-white/5 rounded-2xl text-xs text-white/50 leading-relaxed">
                        Refund credit is recovered from failed or cancelled VRF requests. Claiming will move these assets to your Bank position.
                     </div>

                     {claimRefundFlow.error && <ErrorCallout title="Tx Error" message={claimRefundFlow.error.message} />}

                     <Button 
                        onClick={() => void handleClaimRefund()}
                        disabled={!account || readOnly || claimRefundFlow.busy || refundCredit === 0n}
                        className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/20"
                     >
                        {claimRefundFlow.busy ? "Executing claim..." : "Claim Refund Credit"}
                     </Button>

                     {claimRefundFlow.hasActivity && (
                       <div className="mt-4 pt-4 border-t border-white/5">
                          <TxStepper 
                             title="Claim Manifest" 
                             steps={claimRefundFlow.steps} 
                             footer={<Button variant="ghost" size="sm" onClick={claimRefundFlow.reset} className="text-[10px] text-white/30 p-0 h-auto">Reset Trace</Button>}
                          />
                       </div>
                     )}
                  </GlassCard>

                  <div className="flex flex-col gap-4">
                     <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest">Release Context</h3>
                     <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 text-xs">
                           <span className="text-white/40">Release Digest</span>
                           <span className="font-mono text-indigo-300">{shortHex(release?.releaseDigest)}</span>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 text-xs">
                           <span className="text-white/40">Session Integrity</span>
                           <span className={cn("font-bold px-2 py-1 rounded", readOnly ? "text-amber-400 bg-amber-400/10" : "text-emerald-400 bg-emerald-400/10")}>{readOnly ? "Read-only" : "Writable"}</span>
                        </div>
                     </div>
                  </div>
              </div>
           </div>
        </div>

      </main>
    </PageTransition>
  );
}
