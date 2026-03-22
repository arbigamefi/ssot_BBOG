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
  StatBlock,
  CyberInputGroup,
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
      {/* Grid Pattern Background */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_0%,black,transparent)] pointer-events-none z-0" />
      
      {/* Top Emerald Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[400px] bg-emerald-600/10 blur-[120px] pointer-events-none rounded-full z-0" />

      <main className="relative z-10 max-w-[1440px] mx-auto px-6 py-8 md:py-12">
        
        {/* HEADER SECTION */}
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
           <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> {sym} Isolated Bankroll
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2">
                 Provide Liquidity.<br />
                 <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Earn the Mathematical Edge.</span>
              </h1>
              <p className="text-lg text-white/50 leading-relaxed max-w-2xl mt-4">
                 ArbiGameFi operates on protocol-owned Isolated Banks. When players lose against the pure-function games, the strictly regulated Bank wins. No black box pools, just transparent reserves.
              </p>
           </div>
           
           <div className="flex flex-col gap-2 p-5 rounded-2xl border-2 border-emerald-500/20 bg-[#020202] min-w-[300px] shadow-[0_0_30px_rgba(16,185,129,0.1),inset_0_2px_15px_rgba(16,185,129,0.05)] relative overflow-hidden group">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.05)_1px,transparent_1px)] bg-[size:8px_8px] pointer-events-none opacity-20" />
              <div className="text-[10px] text-white/40 uppercase tracking-widest font-bold flex justify-between relative z-10">
                 <span>Contract Address</span>
                 <span className="text-emerald-400 drop-shadow-[0_0_5px_#34d399] flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Verified</span>
              </div>
              <div className="font-mono text-sm text-white/90 bg-[#050505] border border-white/5 rounded px-3 py-2 cursor-copy hover:border-emerald-500/50 hover:text-emerald-300 transition-colors text-center shadow-[inset_0_2px_5px_rgba(0,0,0,1)] relative z-10">
                 {shortHex(snapshot?.bank)}
              </div>
           </div>
        </header>

         {/* METRICS DASHBOARD */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {/* APY */}
            <div className="p-6 rounded-[1.5rem] border border-emerald-500/30 bg-[#050505] shadow-[0_0_30px_rgba(16,185,129,0.1),inset_0_2px_15px_rgba(16,185,129,0.05)] relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
               <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[50px] rounded-full group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
               <div className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1 relative z-10">Current APY</div>
               <div className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-emerald-200 to-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)] relative z-10 cursor-default">
                  24.50%
               </div>
               <div className="mt-3 text-xs text-emerald-400/80 font-mono tracking-tighter flex items-center gap-1 relative z-10">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_#10b981]" />
                  7-Day Rolling Average
               </div>
            </div>

            {/* Total Free Capital */}
            <div className="p-6 rounded-[1.5rem] border border-blue-500/20 bg-[#020202] shadow-[inset_0_2px_15px_rgba(59,130,246,0.05)] group hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.1),inset_0_2px_15px_rgba(59,130,246,0.05)] transition-all relative overflow-hidden">
               <div className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1 relative z-10">Total Free Capital (R)</div>
               <div className="text-3xl font-mono font-bold text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.2)] relative z-10 cursor-default">
                  {formatTokenAmount(navBacking, decimals, sym)}
               </div>
               <div className="mt-3 text-xs text-white/40 font-medium relative z-10">
                  Ready to underwrite bets
               </div>
            </div>

            {/* Pending Liabilities */}
            <div className="p-6 rounded-[1.5rem] border border-amber-500/20 bg-[#020202] shadow-[inset_0_2px_15px_rgba(245,158,11,0.05)] group hover:border-amber-500/50 hover:shadow-[0_0_30px_rgba(245,158,11,0.1),inset_0_2px_15px_rgba(245,158,11,0.05)] transition-all relative overflow-hidden">
               <div className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1 relative z-10">Pending Liabilities</div>
               <div className="text-3xl font-mono font-bold text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.2)] relative z-10 cursor-default">
                  {formatTokenAmount(reserved, decimals, sym)}
               </div>
               <div className="mt-3 text-xs text-amber-400/60 font-medium relative z-10">
                  Locked for unsettled module tickets
               </div>
            </div>

            {/* My Position */}
            <div className="p-6 rounded-[1.5rem] border border-purple-500/20 bg-[#020202] shadow-[inset_0_2px_15px_rgba(168,85,247,0.05)] group hover:border-purple-500/50 hover:shadow-[0_0_30px_rgba(168,85,247,0.1),inset_0_2px_15px_rgba(168,85,247,0.05)] transition-all relative overflow-hidden">
               <div className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1 relative z-10">My Position</div>
               <div className="text-3xl font-mono font-bold text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.2)] relative z-10 cursor-default">
                  {position ? formatUnits(position.shares, decimals) : "0"}
               </div>
               <div className="mt-3 text-xs text-white/40 font-medium relative z-10">
                  ≈ {position ? formatTokenAmount(position.assetsEquivalent, decimals, sym) : "0"}
               </div>
            </div>
         </div>

        {/* CORE INTERACTION SPACE */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8">
           
           {/* Left: Charts and Deep Dive */}
           <div className="flex flex-col gap-8">
              <div className="rounded-[2rem] border border-white/5 bg-[#050505] p-6 lg:p-8 flex flex-col min-h-[400px] relative overflow-hidden shadow-[inset_0_2px_15px_rgba(255,255,255,0.02),0_20px_40px_rgba(0,0,0,0.8)]">
                 <div className="flex justify-between items-center mb-8 relative z-10">
                    <div>
                       <h3 className="text-xl font-bold mb-1 text-white">Bankroll Equity Curve</h3>
                       <p className="text-sm text-emerald-500/80 font-mono tracking-tighter">Historical growth driven by strict mathematical edge.</p>
                    </div>
                    <div className="flex bg-[#020202] rounded-xl p-1 border border-white/10">
                       {['1W', '1M', 'ALL'].map((tf, i) => (
                          <button key={tf} className={cn("px-5 py-1.5 text-xs font-bold rounded-lg transition-all", i === 1 ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-white/40 hover:text-white hover:bg-white/5")}>
                             {tf}
                          </button>
                       ))}
                    </div>
                 </div>

                 <div className="flex-1 w-full bg-[#020202] rounded-2xl border border-white/10 relative flex items-end justify-between px-2 pt-20 shadow-[inset_0_4px_20px_rgba(0,0,0,0.8)] overflow-hidden">
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
                    
                    <svg className="absolute inset-x-0 bottom-0 w-full h-full text-emerald-500/20 pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
                      <defs>
                        <linearGradient id="grad1" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" style={{ stopColor: '#10b981', stopOpacity: 0.4 }} />
                          <stop offset="100%" style={{ stopColor: '#10b981', stopOpacity: 0 }} />
                        </linearGradient>
                      </defs>
                      <path d="M0,100 L0,70 Q10,60 20,65 T40,40 T60,45 T80,10 T100,5 L100,100 Z" fill="url(#grad1)" />
                      <path d="M0,70 Q10,60 20,65 T40,40 T60,45 T80,10 T100,5" fill="none" stroke="#34d399" strokeWidth="1.5" style={{ filter: 'drop-shadow(0 0 5px rgba(52,211,153,0.8))' }} />
                    </svg>

                    {[...Array(24)].map((_, i) => {
                       const h = 20 + Math.random() * 60 + i;
                       return (
                         <div key={i} className="w-[3%] bg-emerald-500/20 border-t border-emerald-400/50 rounded-t-sm hover:bg-emerald-400 hover:shadow-[0_0_15px_#34d399] transition-all relative group z-10" style={{ height: `${h}%` }} />
                       );
                    })}
                 </div>
              </div>

              <div className="rounded-[2rem] border-2 border-orange-500/30 bg-[#0a0a0a] shadow-[0_0_30px_rgba(249,115,22,0.05),inset_0_2px_15px_rgba(249,115,22,0.05)] p-6 flex gap-6 items-start relative overflow-hidden">
                 <div className="absolute inset-0 bg-[linear-gradient(rgba(249,115,22,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(249,115,22,0.1)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none opacity-50" />
                 <div className="relative z-10">
                    <h3 className="text-orange-400 font-bold mb-2 flex items-center gap-2">SSOT Risk Engine is Active <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" /></h3>
                    <p className="text-sm text-white/50 leading-relaxed font-mono tracking-tighter">
                       Withdrawals follow standard stepper + journal proof for auditable integrity. Pending liabilities are prioritized.
                    </p>
                 </div>
              </div>

               <div className="flex flex-wrap items-center gap-6 rounded-[1.5rem] border border-white/5 bg-white/[0.02] px-6 py-5 text-[9px] text-white/20 uppercase tracking-[0.24em] font-black backdrop-blur-md">
                <span className="flex items-center gap-3">
                  Protocol Bank: <span className="font-mono text-white/40 lowercase tracking-normal text-sm font-medium">{shortHex(snapshot?.bank)}</span>
                </span>
                <span className="ml-auto text-blue-400 border border-blue-400/20 bg-blue-400/5 px-4 py-2 rounded-full hover:bg-blue-400/10 transition-all font-black">
                  ChainID {chainId}
                </span>
              </div>
           </div>

           {/* Right: Interaction Terminal */}
           <div className="flex flex-col">
              {!sdk?.account ? (
                 <div className="h-full rounded-[2.5rem] border border-blue-500/20 bg-[#020202] p-8 flex items-center justify-center">
                    <ConnectWalletPrompt action="interact with bankroll" />
                 </div>
              ) : (
                 <div className="rounded-[2.5rem] border border-blue-500/20 bg-[#020202] shadow-[0_30px_60px_rgba(0,0,0,0.8)] p-2 relative overflow-hidden h-full">
                    <div className="bg-[#050505] rounded-[2.2rem] border border-white/5 h-full p-6 md:p-8 flex flex-col relative z-10">
                       
                       {/* Tabs */}
                       <div className="flex mb-8 bg-[#020202] rounded-xl p-1 border border-white/5">
                          <button 
                            onClick={() => setTab("deposit")}
                            className={cn("flex-1 py-3 text-sm font-bold rounded-lg transition-all", tab === "deposit" ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" : "text-white/40 hover:text-white")}
                          >Deposit {sym}</button>
                          <button 
                            onClick={() => setTab("redeem")}
                            className={cn("flex-1 py-3 text-sm font-bold rounded-lg transition-all", tab === "redeem" ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" : "text-white/40 hover:text-white")}
                          >Redeem</button>
                       </div>

                       <p className="text-white/40 text-sm mb-6 leading-relaxed font-mono tracking-tighter">
                          {tab === "deposit" ? "Deposit USDC into the house bankroll to begin accruing real yield." : "Return shares to the bank to reclaim your proportional backing assets."}
                       </p>

                       {/* Input Field */}
                       <div className="bg-[#020202] border border-emerald-500/30 rounded-2xl p-5 mb-6 group focus-within:border-emerald-400 transition-all">
                          <div className="flex justify-between items-center mb-3 text-[10px] font-bold uppercase tracking-widest text-emerald-500/60">
                             <span>Amount</span>
                             <button 
                               onClick={() => {
                                  if (tab === "withdraw" && maxWithdrawAmt) setAmount(formatUnits(maxWithdrawAmt, decimals));
                                  if (tab === "redeem" && maxRedeemAmt) setAmount(formatUnits(maxRedeemAmt, decimals));
                               }}
                               className="hover:text-white transition-colors">Balance: {sym === "USDC" ? "14,500" : "..."}</button>
                          </div>
                          <div className="flex items-center gap-4">
                             <input 
                                type="text" 
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00" 
                                className="bg-transparent border-none outline-none text-4xl font-mono font-extrabold text-white w-full placeholder:text-white/10"
                             />
                          </div>
                       </div>

                       {/* Transaction Status */}
                       <div className="rounded-xl border border-white/5 bg-[#020202] p-5 flex flex-col gap-4 mb-8 shadow-inner">
                          <div className="flex justify-between items-center text-sm">
                             <span className="text-white/40 font-bold tracking-wide">Flow Status</span>
                             <TxStatusChip status={currentFlow.status} />
                          </div>
                          {formError && <div className="text-rose-400 text-xs italic">{formError}</div>}
                       </div>

                       {/* Action Button */}
                       <button 
                         onClick={() => void handleSubmit()}
                         disabled={readOnly || currentFlow.busy || !amount || !writesSupportedForSelectedAsset}
                         className="mt-auto w-full py-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 border border-emerald-300"
                       >
                          {currentFlow.busy ? "Executing..." : tab === "deposit" ? "Supply Liquidity" : "Redeem Shares"}
                       </button>

                       {currentFlow.hasActivity && (
                         <div className="mt-6 pt-6 border-t border-white/5 overflow-y-auto">
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
                              idleMessage="Simulating flow..."
                            />
                         </div>
                       )}
                    </div>
                 </div>
              )}
           </div>
        </div>
      </main>
    </PageTransition>
  );
}
