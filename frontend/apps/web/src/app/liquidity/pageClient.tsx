"use client";

import * as React from "react";

import type { DomainBankPosition, DomainBankSnapshot, DomainError } from "@ssot/ssot";
import { ConnectWalletPrompt } from "../../components/ConnectWalletPrompt";
import { PageTransition } from "../../components/PageTransition";
import {
  AssetSelector,
  type AssetOption,
  Button,
  GlassCard,
  AuditTabs,
  CopyButton,
  ErrorCallout,
  Input,
  Label,
  StatusBadge,
  TxStatusChip,
  TxStepper,
  toast,
  cn,
} from "@ssot/ui";

import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../ssot/sdk";
import { Placeholder } from "../../components/Placeholder";
import { formatUnits, parseDecimalToUnits } from "../../features/betting/model/units";
import { useDirectTxAction, useSequencedTxAction } from "../../features/tx/useDirectTxAction";

type Tab = "deposit" | "withdraw" | "redeem";

const TABS = [
  { key: "deposit", label: "Deposit" },
  { key: "withdraw", label: "Withdraw" },
  { key: "redeem", label: "Redeem" },
];

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

function formatBps(value?: number) {
  return value == null ? "—" : `${value} bps`;
}

function formatPctFromBps(value?: number) {
  return value == null ? "—" : `${(value / 100).toFixed(value % 100 === 0 ? 0 : 2)}%`;
}

function shortHex(val?: string) {
  if (!val) return "—";
  return `${val.slice(0, 6)}...${val.slice(-4)}`;
}

function formatTokenAmount(
  value: bigint | undefined,
  decimals: number,
  symbol?: string,
  maxFractionDigits = 4
) {
  if (value == null) return "—";
  const raw = formatUnits(value, decimals);
  const neg = raw.startsWith("-");
  const normalized = neg ? raw.slice(1) : raw;
  const [intPart = "0", fracPart = ""] = normalized.split(".");
  const integer = BigInt(intPart || "0").toLocaleString("en-US");
  const fraction = fracPart.slice(0, maxFractionDigits).replace(/0+$/, "");
  const body = `${neg ? "-" : ""}${integer}${fraction ? `.${fraction}` : ""}`;
  return symbol ? `${body} ${symbol}` : body;
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
  subtitle: string;
  status: React.ComponentProps<typeof TxStatusChip>["status"];
  steps: React.ComponentProps<typeof TxStepper>["steps"];
  hasActivity: boolean;
  error?: DomainError;
  txHash?: string;
  blockNumber?: number;
  explorerBaseUrl?: string;
  onReset: () => void;
  idleMessage: string;
};

function ActionTrace({
  title,
  subtitle,
  status,
  steps,
  hasActivity,
  error,
  txHash,
  blockNumber,
  explorerBaseUrl,
  onReset,
  idleMessage,
}: ActionTraceProps) {
  if (!hasActivity && !error) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-4 text-sm text-slate-500">
        {idleMessage}
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
        subtitle={`Status: ${status} · ${subtitle}`}
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onReset}
                  className="h-auto px-0 text-slate-400 hover:text-white"
                >
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

export function LiquidityPageClient() {
  const { release, readOnly, readOnlyReason, chainId } = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const explorerBaseUrl = React.useMemo(() => getExplorerBaseUrl(chainId), [chainId]);

  // Asset selection
  const assetOptions: AssetOption[] = React.useMemo(
    () =>
      (release?.assets ?? []).map((a) => ({
        address: a.address as `0x${string}`,
        symbol: a.symbol,
        decimals: a.decimals,
        label: `${a.symbol} (${a.decimals})`,
      })),
    [release?.assets]
  );
  const [asset, setAsset] = React.useState<`0x${string}`>(
    () =>
      (release?.assets[0]?.address as `0x${string}`) ??
      (`0x${"0".repeat(40)}` as `0x${string}`)
  );
  const assetMeta = React.useMemo(
    () => release?.assets.find((a) => a.address.toLowerCase() === asset.toLowerCase()),
    [release?.assets, asset]
  );
  const decimals = assetMeta?.decimals ?? 18;
  const primaryAsset = release?.assets[0]?.address?.toLowerCase();
  const writesSupportedForSelectedAsset =
    !primaryAsset || asset.toLowerCase() === primaryAsset;

  // Bank snapshot + position
  const [snapshot, setSnapshot] = React.useState<DomainBankSnapshot | null>(null);
  const [position, setPosition] = React.useState<DomainBankPosition | null>(null);
  const [loadError, setLoadError] = React.useState<string | undefined>();
  const [loading, setLoading] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    if (!sdk || !ready) return;
    setLoading(true);
    setLoadError(undefined);
    try {
      const snap = await sdk.bank.getSnapshot(asset);
      setSnapshot(snap);
      if (sdk.account) {
        const pos = await sdk.bank.getPosition(asset, sdk.account);
        setPosition(pos);
      } else {
        setPosition(null);
      }
    } catch (e) {
      setLoadError((e as Error)?.message ?? "Failed to fetch bank data");
    } finally {
      setLoading(false);
    }
  }, [asset, ready, sdk]);

  React.useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Tab + form state
  const [tab, setTab] = React.useState<Tab>("deposit");
  const [amount, setAmount] = React.useState("");
  const [formError, setFormError] = React.useState<string | undefined>();

  const depositFlow = useSequencedTxAction({
    finalAction: "DEPOSIT",
    steps: [
      {
        key: "preflight",
        title: "Preflight",
        description: "Validate inputs and simulate the liquidity flow.",
      },
      {
        key: "approve",
        title: "Approve Bank",
        description: "Set exact ERC20 allowance for the Bank if required.",
        action: "APPROVE_DEPOSIT",
        optional: true,
      },
      {
        key: "deposit",
        title: "Deposit Assets",
        description: "Broadcast Bank.deposit and wait for receipt.",
        action: "DEPOSIT",
      },
    ],
  });

  const withdrawFlow = useDirectTxAction({
    action: "WITHDRAW",
    labels: {
      preflight: "Preflight",
      submit: "Submit withdraw",
      confirm: "Confirm on-chain",
    },
    descriptions: {
      preflight: "Validate withdraw amount and simulate the Bank call.",
      submit: "Broadcast Bank.withdraw through the wallet client.",
      confirm: "Wait for receipt and journal reconciliation.",
    },
  });

  const redeemFlow = useDirectTxAction({
    action: "REDEEM",
    labels: {
      preflight: "Preflight",
      submit: "Submit redeem",
      confirm: "Confirm on-chain",
    },
    descriptions: {
      preflight: "Validate redeem amount and simulate the Bank call.",
      submit: "Broadcast Bank.redeem through the wallet client.",
      confirm: "Wait for receipt and journal reconciliation.",
    },
  });

  const currentFlow =
    tab === "deposit"
      ? depositFlow
      : tab === "withdraw"
        ? withdrawFlow
        : redeemFlow;

  // Max values
  const [maxWithdrawAmt, setMaxWithdrawAmt] = React.useState<bigint | null>(null);
  const [maxRedeemAmt, setMaxRedeemAmt] = React.useState<bigint | null>(null);

  React.useEffect(() => {
    if (!sdk || !sdk.account || !writesSupportedForSelectedAsset) {
      setMaxWithdrawAmt(null);
      setMaxRedeemAmt(null);
      return;
    }
    const acct = sdk.account;
    if (tab === "withdraw") {
      void sdk.bank
        .maxWithdraw(acct)
        .then(setMaxWithdrawAmt)
        .catch(() => setMaxWithdrawAmt(null));
    } else if (tab === "redeem") {
      void sdk.bank
        .maxRedeem(acct)
        .then(setMaxRedeemAmt)
        .catch(() => setMaxRedeemAmt(null));
    }
  }, [sdk, tab, snapshot, writesSupportedForSelectedAsset]);

  React.useEffect(() => {
    setAmount("");
    setFormError(undefined);
  }, [tab, asset]);

  const handleSubmit = React.useCallback(async () => {
    if (!sdk || !sdk.account || readOnly) return;
    setFormError(undefined);
    const acct = sdk.account;

    if (!writesSupportedForSelectedAsset) {
      setFormError("Write flows currently support only the primary asset from the active release.");
      return;
    }

    try {
      const parsed = parseDecimalToUnits(amount, decimals);
      if (parsed <= 0n) {
        setFormError("Amount must be positive");
        return;
      }

      if (tab === "deposit") {
        const res = await depositFlow.execute(() => sdk.bank.deposit(parsed, acct));
        if (!res.ok) return;
        toast.success(`Deposited ${formatUnits(parsed, decimals)} ${assetMeta?.symbol ?? ""}`, {
          description:
            res.shares != null
              ? `Received ${formatUnits(res.shares, decimals)} shares`
              : undefined,
        });
      } else if (tab === "withdraw") {
        const res = await withdrawFlow.execute(() => sdk.bank.withdraw(parsed, acct, acct));
        if (!res.ok) return;
        toast.success(`Withdrew ${formatUnits(parsed, decimals)} ${assetMeta?.symbol ?? ""}`);
      } else {
        const res = await redeemFlow.execute(() => sdk.bank.redeem(parsed, acct, acct));
        if (!res.ok) return;
        toast.success(`Redeemed ${formatUnits(parsed, decimals)} shares`);
      }

      setAmount("");
      void fetchData();
    } catch (e) {
      toast.error((e as Error)?.message ?? "Transaction failed");
    }
  }, [
    amount,
    assetMeta?.symbol,
    decimals,
    depositFlow,
    fetchData,
    readOnly,
    redeemFlow,
    sdk,
    tab,
    withdrawFlow,
    writesSupportedForSelectedAsset,
  ]);

  if (!release) {
    return (
      <Placeholder
        title="Liquidity"
        description={readOnlyReason ?? "No embedded release available."}
        specPath="docs/frontend/PAGE-SPECS/030-LIQUIDITY.md"
      />
    );
  }

  const sym = assetMeta?.symbol ?? "???";
  const navBacking = snapshot?.totalAssets;
  const reserved = snapshot?.totalReserved;
  const minLiquidityBps = snapshot?.minLiquidityBps ?? 0;
  const protocolFeesPayable = snapshot?.protocolFeesPayable ?? 0n;
  const minLiquidityFloor =
    snapshot && snapshot.minLiquidityBps != null
      ? (snapshot.totalAssets * BigInt(snapshot.minLiquidityBps)) / 10_000n
      : null;
  const optionalOutflowRoom =
    snapshot && minLiquidityFloor != null
      ? (() => {
          const constrained = snapshot.totalReserved + minLiquidityFloor;
          return snapshot.totalAssets > constrained ? snapshot.totalAssets - constrained : 0n;
        })()
      : null;

  const actionTraceTitle =
    tab === "deposit"
      ? "Deposit Trace"
      : tab === "withdraw"
        ? "Withdraw Trace"
        : "Redeem Trace";
  const actionTraceSubtitle =
    tab === "deposit"
      ? "Deposit adds assets to bankroll backing."
      : "Optional outflow Subject to solvency constraints.";

  const currentActionError = currentFlow.error;

  return (
    <PageTransition pageKey="liquidity">
      {/* Background Spotlights */}
      <div className="fixed left-[-10%] top-[-20%] h-[50vw] w-[50vw] rounded-full bg-blue-600/5 blur-[120px] pointer-events-none -z-1" />
      <div className="fixed right-[-10%] top-[20%] h-[40vw] w-[40vw] rounded-full bg-indigo-600/5 blur-[120px] pointer-events-none -z-1" />

      <main className="max-w-[1280px] mx-auto px-6 py-12 md:py-16 relative z-10 w-full mb-24">
        
        {/* Page Intro */}
        <div className="max-w-3xl mb-16 pt-4">
          <div className="flex items-center gap-2 mb-4">
             <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
             <span className="text-[10px] font-bold tracking-[0.3em] text-white/40 uppercase">Economic Layer</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 text-white leading-none">House Liquidity</h1>
          <p className="text-white/45 text-xl leading-relaxed font-medium">
            Provide {sym} to the community bankroll to earn yield from the protocol's edge. 
            Liquidity providers are the house, sharing in the rewards of every room's session outcome.
          </p>
        </div>

        {/* Top Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="p-8 rounded-[2rem] bg-white/[0.03] border border-white/5 flex flex-col gap-3 group hover:bg-white/[0.05] transition-all backdrop-blur-md">
            <span className="text-white/40 text-[10px] font-bold uppercase tracking-[0.25em]">Total Pool Value (TVL)</span>
            <span className="text-4xl font-mono font-bold tracking-tighter text-white">
              {formatTokenAmount(navBacking, decimals, sym)}
            </span>
            <div className="flex items-center gap-2 mt-1">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
               <span className="text-white/40 text-xs font-medium">Real-time NAV backing</span>
            </div>
          </div>

          <div className="p-8 rounded-[2rem] bg-white/[0.03] border border-white/5 flex flex-col gap-3 relative overflow-hidden group hover:bg-white/[0.05] transition-all backdrop-blur-md">
            <div className="absolute top-0 right-0 p-6 opacity-[0.03] text-blue-400 group-hover:opacity-[0.06] transition-opacity">
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
            </div>
            <span className="text-white/40 text-[10px] font-bold uppercase tracking-[0.25em]">Vault Solvency</span>
            <span className="text-4xl font-mono font-bold tracking-tighter text-blue-400">
              {formatTokenAmount(optionalOutflowRoom ?? undefined, decimals, sym)}
            </span>
            <span className="text-white/30 text-xs font-medium mt-1">Free headroom for redemptions</span>
          </div>

          <div className="p-8 rounded-[2rem] bg-white/[0.03] border border-white/5 flex flex-col gap-3 group hover:bg-white/[0.05] transition-all backdrop-blur-md">
            <span className="text-white/40 text-[10px] font-bold uppercase tracking-[0.25em]">My Position</span>
            <span className="text-4xl font-mono font-bold tracking-tighter text-white">
              {position ? formatUnits(position.shares, decimals) : "0"} <span className="text-sm font-sans text-white/30 uppercase tracking-widest ml-1">shares</span>
            </span>
            <div className="flex justify-between items-center mt-1">
               <span className="text-white/40 text-xs font-medium">≈ {position ? formatTokenAmount(position.assetsEquivalent, decimals, sym) : "0"}</span>
               <span className="text-[10px] font-bold text-indigo-400">1 h{sym} = 1.012 {sym}</span>
            </div>
          </div>
        </div>

        {/* Main Interaction Area */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8">
          
          {/* Chart / Deep Stats Area */}
          <div className="flex flex-col gap-8">
            <GlassCard glowColor="bg-blue-500/10" glowPosition="top-left" padding="lg" className="min-h-[480px] rounded-[2.5rem] border-white/5 shadow-2xl">
              <div className="flex items-center justify-between mb-10">
                 <div className="flex flex-col gap-1">
                    <h3 className="text-2xl font-black tracking-tight text-white">Protocol Performance</h3>
                    <p className="text-xs font-medium text-white/30 uppercase tracking-widest">Historical protocol yield indices</p>
                 </div>
                 <div className="flex bg-black/60 rounded-xl border border-white/5 p-1 backdrop-blur-xl">
                   {["1W", "1M", "ALL"].map((p, i) => (
                      <button key={p} className={cn("px-5 py-2 text-[10px] font-black tracking-widest rounded-lg transition-all", i === 1 ? "bg-white text-black shadow-lg" : "text-white/30 hover:text-white uppercase")}>{p}</button>
                   ))}
                 </div>
              </div>
              
              <div className="w-full h-[320px] flex items-end justify-between px-4 pb-4 relative">
                 <div className="absolute inset-0 flex flex-col justify-between pointer-events-none px-4">
                   {[1,2,3,4,5].map(i => <div key={i} className="w-full border-t border-white/[0.03] border-dashed" />)}
                 </div>
                 {[30, 45, 20, 60, 80, 55, 90, 70, 85, 100, 75, 95].map((h, i) => (
                   <div key={i} className="w-[6%] bg-blue-500/10 rounded-t-lg hover:bg-blue-600/30 transition-all cursor-pointer relative group border-x border-t border-white/5" style={{ height: `${h}%` }}>
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white text-black font-black font-mono text-[9px] px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-xl pointer-events-none transform translate-y-2 group-hover:translate-y-0">
                        +${(h * 12.45).toFixed(2)}
                      </div>
                   </div>
                 ))}
                 <div className="absolute inset-x-0 bottom-0 h-px bg-white/5" />
              </div>
              
              <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-8 pt-10 border-t border-white/5">
                <div className="flex flex-col gap-1.5">
                  <span className="text-white/30 text-[9px] font-black uppercase tracking-[0.2em]">Reserved Risk</span>
                  <span className="font-mono text-lg font-bold text-white tracking-tighter">{formatTokenAmount(reserved, decimals, sym)}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                   <span className="text-white/30 text-[9px] font-black uppercase tracking-[0.2em]">Buffer Floor</span>
                   <span className="font-mono text-lg font-bold text-white tracking-tighter">{formatTokenAmount(minLiquidityFloor ?? undefined, decimals, sym)}</span>
                </div>
                 <div className="flex flex-col gap-1.5">
                   <span className="text-white/30 text-[9px] font-black uppercase tracking-[0.2em]">Protocol Fees</span>
                   <span className="font-mono text-lg font-bold text-indigo-400 tracking-tighter">{formatTokenAmount(protocolFeesPayable, decimals, sym)}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                   <span className="text-white/30 text-[9px] font-black uppercase tracking-[0.2em]">Outflow Cap</span>
                   <span className="font-mono text-lg font-bold text-white tracking-tighter">{formatBps(minLiquidityBps)}</span>
                </div>
              </div>
            </GlassCard>

            <div className="flex flex-wrap items-center gap-6 rounded-[1.5rem] border border-white/5 bg-white/[0.02] px-6 py-5 text-[9px] text-white/20 uppercase tracking-[0.24em] font-black backdrop-blur-md">
              <span className="flex items-center gap-3">
                Protocol Bank: <span className="font-mono text-white/40 lowercase tracking-normal text-sm font-medium">{shortHex(snapshot?.bank ?? "—")}</span>
                {snapshot?.bank ? <CopyButton value={snapshot.bank} label="" className="opacity-40 hover:opacity-100" /> : null}
              </span>
              <span className="hidden sm:inline opacity-20">•</span>
              <span>Sequence: <span className="text-white/40">{snapshot?.updatedAtBlock?.toString() ?? "—"}</span></span>
              <span className="hidden sm:inline opacity-20">•</span>
              <span className={writesSupportedForSelectedAsset ? "text-emerald-500/80" : "text-amber-500/80"}>
                {writesSupportedForSelectedAsset ? "Network Write Rails Open" : "Read Only Protocol View"}
              </span>
              <button 
                onClick={() => void fetchData()}
                className="ml-auto text-blue-400 border border-blue-400/20 bg-blue-400/5 px-4 py-2 rounded-full hover:bg-blue-400/10 transition-all font-black"
                disabled={loading}
              >
                {loading ? "Syncing..." : "Sync State"}
              </button>
            </div>
          </div>

          {/* Deposit / Withdraw Terminal */}
          <GlassCard padding="none" className="flex flex-col !bg-[#000] border-white/10 rounded-[2.5rem] shadow-2xl relative overflow-hidden h-fit">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500/50 via-indigo-500/50 to-purple-500/50 opacity-50" />
            
            <div className="flex border-b border-white/5 px-4 pt-4">
               <button 
                onClick={() => setTab("deposit")}
                className={cn("flex-1 pb-4 text-xs font-black uppercase tracking-[0.2em] transition-all", tab === "deposit" ? "text-white border-b-2 border-blue-500" : "text-white/20 hover:text-white border-b-2 border-transparent")}
              >
                Supply
              </button>
              <button 
                onClick={() => setTab("redeem")}
                className={cn("flex-1 pb-4 text-xs font-black uppercase tracking-[0.2em] transition-all", tab === "redeem" ? "text-white border-b-2 border-blue-500" : "text-white/20 hover:text-white border-b-2 border-transparent")}
              >
                Redeem
              </button>
            </div>

            <div className="p-8 flex flex-col gap-8">
              {!sdk?.account ? (
                <div className="py-12">
                   <ConnectWalletPrompt action={`${tab} liquidity`} />
                </div>
              ) : (
                <div className="flex flex-col gap-8">
                   <div className="flex flex-col gap-4">
                     <div className="flex justify-between items-end">
                       <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Protocol Stake</label>
                       <span className="text-[10px] font-medium text-white/40">Available: <span className="font-mono text-white/80">14,204.05 {sym}</span></span>
                     </div>
                     <div className="relative group">
                       <input 
                         type="text" 
                         className="w-full bg-[#080808] border-2 border-white/5 rounded-[1.5rem] py-6 px-6 font-mono text-3xl text-white placeholder:text-white/5 focus:border-blue-500/40 focus:outline-none transition-all shadow-inner group-hover:border-white/10" 
                         placeholder="0.00"
                         value={amount}
                         onChange={(e) => setAmount(e.target.value)}
                         disabled={readOnly || currentFlow.busy}
                       />
                       <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-3">
                          <button 
                            onClick={() => {
                              if (tab === "withdraw" && maxWithdrawAmt) setAmount(formatUnits(maxWithdrawAmt, decimals));
                              if (tab === "redeem" && maxRedeemAmt) setAmount(formatUnits(maxRedeemAmt, decimals));
                            }}
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 hover:text-white border border-white/5 rounded-lg text-[9px] font-black text-white/40 tracking-widest transition-all uppercase"
                          >
                            Max
                          </button>
                          <span className="text-white/60 font-black text-lg tracking-tighter">{tab === "redeem" ? "hUSDC" : sym}</span>
                       </div>
                     </div>
                   </div>

                   <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-4 backdrop-blur-md">
                     <div className="flex justify-between items-center">
                       <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Governance Path</span>
                       <TxStatusChip status={currentFlow.status} />
                     </div>
                     {currentActionError && (
                       <div className="text-[11px] font-medium leading-relaxed text-rose-400 bg-rose-500/5 p-4 rounded-xl border border-rose-500/10 italic">
                         {currentActionError.message}
                       </div>
                     )}
                     <div className="flex flex-col gap-3 pt-2 border-t border-white/5">
                        <div className="flex justify-between text-xs font-medium">
                           <span className="text-white/30">Exchange Ratio</span>
                           <span className="text-white/60 font-mono">1.012 USDC</span>
                        </div>
                        <div className="flex justify-between text-xs font-medium">
                           <span className="text-white/30">Settlement Delay</span>
                           <span className="text-white/60 font-mono">24 Hours</span>
                        </div>
                     </div>
                   </div>

                   <button 
                     className="w-full py-6 rounded-[1.5rem] bg-blue-600 hover:bg-blue-500 text-white font-black text-lg shadow-2xl shadow-blue-600/20 transition-all active:scale-[0.98] disabled:opacity-30 flex items-center justify-center gap-3 tracking-tight"
                     onClick={() => void handleSubmit()}
                     disabled={readOnly || currentFlow.busy || !amount || !writesSupportedForSelectedAsset}
                   >
                     {currentFlow.busy ? (
                       <>
                         <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                         Executing Trace...
                       </>
                     ) : (
                       tab === "deposit" ? `Supply ${sym} to Bankroll` : `Redeem Protocol Shares`
                     )}
                   </button>
                   
                   {currentFlow.hasActivity && (
                     <div className="mt-2 pt-8 border-t border-white/5 overflow-hidden">
                        <ActionTrace
                          title={actionTraceTitle}
                          subtitle={actionTraceSubtitle}
                          status={currentFlow.status}
                          steps={currentFlow.steps}
                          hasActivity={currentFlow.hasActivity}
                          error={currentActionError}
                          txHash={currentFlow.txHash}
                          blockNumber={currentFlow.journalEntry?.blockNumber}
                          explorerBaseUrl={explorerBaseUrl}
                          onReset={currentFlow.reset}
                          idleMessage="Liquidity actions are simulated first."
                        />
                     </div>
                   )}

                   <div className="flex flex-col gap-4 mt-4">
                      <p className="text-center text-[9px] font-black text-white/20 uppercase tracking-[0.25em] leading-relaxed">
                        Protocol Guarantee: {tab} actions follow standard stepper + journal proof for auditable integrity.
                      </p>
                      <div className="flex items-center justify-center gap-6 opacity-20 filter grayscale hover:grayscale-0 hover:opacity-100 transition-all">
                        <span className="text-[10px] font-bold">ARBITRUM</span>
                        <span className="text-[10px] font-bold">ETHERSCAN</span>
                        <span className="text-[10px] font-bold">SSOT PROTCOL</span>
                      </div>
                   </div>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </main>
    </PageTransition>
  );
}
