"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { DomainBet, DomainError } from "@ssot/ssot";
import type { HubEventRow } from "@ssot/ssot/indexer";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CopyButton,
  ErrorCallout,
  GlassCard,
  PageHeader,
  StatCard,
  StatusBadge,
  TxStatusChip,
  TxStepper,
  type StepState,
  type TxStepItem,
  toast,
  cn,
} from "@ssot/ui";
import { ArrowLeftIcon, CubeIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

import { PageTransition } from "../../../components/PageTransition";
import { useRelease } from "../../../ssot/release/ReleaseProvider";
import { useSSOTRuntime } from "../../../ssot/runtime";
import { useSSOTSDK } from "../../../ssot/sdk";
import { formatUnits } from "../../../features/betting/model/units";
import { useDirectTxAction } from "../../../features/tx/useDirectTxAction";

function shortHex(value?: string) {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function formatTokenAmount(value: bigint | undefined, decimals: number, symbol?: string, maxFractionDigits = 4) {
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

function formatTimestamp(value?: number) {
  if (!value) return "—";
  const millis = value > 1_000_000_000_000 ? value : value * 1000;
  return new Date(millis).toLocaleString();
}

function formatRelativeTime(timestamp?: number) {
  if (!timestamp) return "—";
  const deltaMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function serializeErrorDetails(error?: DomainError) {
  if (!error?.details) return undefined;
  return JSON.stringify(
    error.details,
    (_key, value) => (typeof value === "bigint" ? value.toString() : value),
    2
  );
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

function Metric({
  label,
  value,
  copyable,
  href,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-800/60 py-3 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="inline-flex items-center gap-2 text-right font-mono text-sm text-slate-200">
        {href && value !== "—" ? (
          <a href={href} target="_blank" rel="noreferrer" className="text-emerald-300 transition-colors hover:text-emerald-200">
            {value}
          </a>
        ) : (
          <span>{value}</span>
        )}
        {copyable && value !== "—" ? <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} /> : null}
      </span>
    </div>
  );
}

function stateToStep(state: string, target: string): StepState {
  const order = ["placed", "randomReady", "finalized"];
  const currentIndex = order.indexOf(state);
  const targetIndex = order.indexOf(target);
  if (state === "refunded") return target === "placed" ? "done" : "error";
  if (currentIndex > targetIndex) return "done";
  if (currentIndex === targetIndex) return "active";
  return "todo";
}

function buildLifecycleSteps(state: string): TxStepItem[] {
  if (state === "refunded") {
    return [
      { title: "Placed", state: "done" },
      { title: "Refunded", description: "Stake returned to the player", state: "done" },
    ];
  }
  return [
    { title: "Placed", state: stateToStep(state, "placed") },
    {
      title: "Random Ready",
      description: "VRF delivered a random word",
      state: stateToStep(state, "randomReady"),
    },
    {
      title: "Finalized",
      description: "Bet settled on the Hub",
      state: stateToStep(state, "finalized"),
    },
  ];
}

function matchesBetId(argsJson: string, expectedBetId: string) {
  try {
    const args = JSON.parse(argsJson) as Record<string, unknown>;
    const raw = args.betId ?? args.id;
    if (typeof raw === "bigint") return raw.toString() === expectedBetId;
    if (typeof raw === "number") return BigInt(raw).toString() === expectedBetId;
    if (typeof raw === "string") {
      if (raw.startsWith("0x")) {
        try {
          return BigInt(raw).toString() === expectedBetId;
        } catch {
          return false;
        }
      }
      return raw === expectedBetId;
    }
    return false;
  } catch {
    return false;
  }
}

export default function BetDetailPage() {
  const params = useParams<{ betId: string }>();
  const betId = params?.betId;
  const { db } = useSSOTRuntime();
  const { sdk } = useSSOTSDK();
  const { chainId, readOnly, release } = useRelease();

  const { data: localBet, isLoading: localLoading } = useQuery({
    queryKey: ["ssot", "bet", chainId, betId],
    enabled: Boolean(db && betId),
    queryFn: async () => {
      if (!db || !betId) return null;
      return await db.bets.get(`${chainId}:${betId}`);
    },
    refetchInterval: 2_000,
  });

  const { data: onChainBet, isLoading: onChainLoading, refetch: refetchOnChain } = useQuery({
    queryKey: ["ssot", "getBet", chainId, betId],
    enabled: Boolean(sdk && betId),
    queryFn: async (): Promise<DomainBet | null> => {
      if (!sdk || !betId) return null;
      try {
        return await sdk.hub.getBet(BigInt(betId));
      } catch {
        return null;
      }
    },
    refetchInterval: 5_000,
  });

  const { data: timeline = [], isLoading: timelineLoading } = useQuery({
    queryKey: ["ssot", "bet", "timeline", chainId, betId],
    enabled: Boolean(db && betId),
    queryFn: async (): Promise<HubEventRow[]> => {
      if (!db || !betId) return [];
      const rows = await db.hubEvents.where("chainId").equals(chainId).toArray();
      return rows
        .filter((row) => matchesBetId(row.argsJson, betId))
        .sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);
    },
    refetchInterval: 2_000,
  });

  const betState = onChainBet?.state ?? localBet?.state ?? null;
  const isLoading = localLoading || onChainLoading;
  const canRefund = betState === "placed" && !readOnly && Boolean(sdk?.account);
  const canFinalize = betState === "randomReady" && !readOnly && Boolean(sdk?.account);

  const gameId = onChainBet?.gameId ?? localBet?.gameId;
  const assetAddress = onChainBet?.asset ?? localBet?.asset;
  const gameMeta = React.useMemo(
    () => release?.gamesMeta?.find((game) => game.gameId.toLowerCase() === gameId?.toLowerCase()),
    [gameId, release?.gamesMeta]
  );
  const assetMeta = React.useMemo(
    () => release?.assets.find((asset) => asset.address.toLowerCase() === assetAddress?.toLowerCase()),
    [assetAddress, release?.assets]
  );

  const symbol = assetMeta?.symbol ?? "";
  const decimals = assetMeta?.decimals ?? 18;
  const explorerBaseUrl = React.useMemo(() => getExplorerBaseUrl(chainId), [chainId]);
  const primaryTxHash = localBet?.lastTxHash ?? timeline[timeline.length - 1]?.txHash;

  const refundFlow = useDirectTxAction({
    action: "REFUND",
    labels: {
      preflight: "Preflight",
      submit: "Submit refund",
      confirm: "Confirm on-chain",
    },
    descriptions: {
      preflight: "Validate refund eligibility and simulate the Hub call.",
      submit: "Broadcast refund through the wallet client.",
      confirm: "Wait for receipt and journal reconciliation.",
    },
  });

  const finalizeFlow = useDirectTxAction({
    action: "FINALIZE",
    labels: {
      preflight: "Preflight",
      submit: "Submit finalize",
      confirm: "Confirm on-chain",
    },
    descriptions: {
      preflight: "Validate finalize eligibility and simulate the Hub call.",
      submit: "Broadcast finalize through the wallet client.",
      confirm: "Wait for receipt and journal reconciliation.",
    },
  });

  const outcome = React.useMemo(() => {
    if (!onChainBet || !betState) return null;
    if (betState === "refunded") return { label: "Refunded", value: onChainBet.refund ?? onChainBet.stake };
    if (betState === "finalized" && onChainBet.payout != null) {
      return {
        label: onChainBet.payout >= onChainBet.stake ? "Net Result" : "Loss",
        value: onChainBet.payout - onChainBet.stake,
      };
    }
    return null;
  }, [betState, onChainBet]);

  const handleRefund = React.useCallback(async () => {
    if (!sdk || !betId) return;
    try {
      const result = await refundFlow.execute(() => sdk.hub.refund(BigInt(betId)));
      if (!result.ok) {
        return;
      }
      toast.success("Bet refunded successfully");
      void refetchOnChain();
    } catch (error) {
      toast.error((error as Error).message ?? "Refund transaction failed");
    }
  }, [betId, refundFlow, refetchOnChain, sdk]);

  const handleFinalize = React.useCallback(async () => {
    if (!sdk || !betId) return;
    try {
      const result = await finalizeFlow.execute(() => sdk.hub.finalize(BigInt(betId)));
      if (!result.ok) {
        return;
      }
      toast.success("Bet finalized successfully");
      void refetchOnChain();
    } catch (error) {
      toast.error((error as Error).message ?? "Finalize transaction failed");
    }
  }, [betId, finalizeFlow, refetchOnChain, sdk]);

  const actionFlow = finalizeFlow.hasActivity
    ? finalizeFlow
    : refundFlow.hasActivity
      ? refundFlow
      : canFinalize
        ? finalizeFlow
        : canRefund
          ? refundFlow
          : null;

  const actionTitle = actionFlow === refundFlow ? "Refund Trace" : "Finalize Trace";
  const actionSubtitle =
    actionFlow === refundFlow
      ? "Refund returns stake to the player when the lifecycle allows it."
      : "Finalize settles a random-ready bet through Hub.finalize().";
  const actionError = refundFlow.error ?? finalizeFlow.error;

  const resultState = React.useMemo(() => {
    if (betState === "finalized" && onChainBet && (onChainBet as any).payout != null) {
       return BigInt((onChainBet as any).payout) > BigInt(onChainBet.stake) ? "won" : "lost";
    }
    return betState;
  }, [betState, onChainBet]);

  return (
    <PageTransition pageKey={`bet-${betId ?? "unknown"}`}>
      <main className="mx-auto flex min-h-[90vh] flex-col items-center justify-center px-6 py-12 md:py-24">
        
        <Link 
          href="/bets" 
          className="mb-8 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-white/30 transition-colors hover:text-white"
        >
           <ArrowLeftIcon className="h-4 w-4" /> Back to Ledger
        </Link>
        
        {/* The Receipt Container */}
        <div className="relative w-full max-w-lg">
           {/* Visual Flourish: Connection Lines */}
           <div className="absolute -left-12 top-1/2 h-px w-12 bg-gradient-to-r from-transparent to-white/10" />
           <div className="absolute -right-12 top-1/2 h-px w-12 bg-gradient-to-l from-transparent to-white/10" />
           
           <div className={cn(
             "relative overflow-hidden rounded-[2.5rem] border-t-4 bg-[#050505] p-10 shadow-2xl transition-all",
             resultState === 'won' ? 'border-t-green-500 shadow-green-500/10' : 
             resultState === 'lost' ? 'border-t-white/10 shadow-white/5' : 
             'border-t-blue-500 shadow-blue-500/10'
           )}>
              {/* Grain Overlay */}
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
              
              {/* State Watermark */}
              <div className={cn(
                "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none text-[120px] font-black tracking-tighter opacity-[0.02] pointer-events-none",
                resultState === 'won' ? 'text-green-500' : 'text-white'
              )}>
                {resultState === 'won' ? 'WON' : resultState === 'lost' ? 'LOST' : 'WAIT'}
              </div>

              {/* Header: Identity */}
              <div className="relative z-10 mb-12 flex flex-col items-center text-center">
                 <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-white/40 shadow-inner">
                    <CubeIcon className="h-8 w-8" />
                 </div>
                 <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">
                    Smart Ticket #{betId ? shortHex(betId) : "—"}
                 </span>
                 <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">{gameMeta?.label ?? "System Node"}</h1>
                 
                 <div className={cn(
                    "mt-4 inline-flex items-center gap-2 rounded-lg border px-3 py-1 text-[10px] font-black uppercase tracking-widest",
                    resultState === 'won' ? 'border-green-500/30 bg-green-500/10 text-green-400' :
                    resultState === 'lost' ? 'border-white/10 bg-white/5 text-white/40' :
                    'border-blue-500/30 bg-blue-500/10 text-blue-400 animate-pulse'
                 )}>
                    {resultState ?? "Awaiting VRF"}
                 </div>
              </div>

              {/* Body: Figures */}
              <div className="relative z-10 grid grid-cols-2 gap-8 rounded-3xl border border-white/5 bg-black/40 p-8 shadow-inner mb-10">
                 <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Commitment</span>
                    <span className="mt-1 font-mono text-2xl font-bold text-white">
                       {onChainBet ? formatTokenAmount(onChainBet.stake, decimals, symbol) : "—"}
                    </span>
                 </div>
                 <div className="flex flex-col items-end text-right">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Realized</span>
                    <span className={cn(
                      "mt-1 font-mono text-2xl font-bold",
                      resultState === 'won' ? 'text-green-400 drop-shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'text-white'
                    )}>
                       {outcome ? formatTokenAmount(outcome.value, decimals, symbol) : "—"}
                    </span>
                 </div>
              </div>

              {/* Details: Table */}
              <div className="relative z-10 mb-10 space-y-4 px-2">
                 <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Settlement Asset</span>
                    <span className="font-mono text-sm font-bold text-white/80">{symbol || "TOKEN"}</span>
                 </div>
                 <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Entry Time</span>
                    <span className="font-mono text-sm font-bold text-white/80">{onChainBet?.placedAt ? formatTimestamp(Number(onChainBet.placedAt)) : "—"}</span>
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Registry Sector</span>
                    <span className="font-mono text-sm font-bold text-white/80">HUB_ALPHA_01</span>
                 </div>
              </div>

              {/* Technicolor Readout: Provable Truth */}
              <div className="relative z-10 rounded-[1.5rem] border border-blue-500/20 bg-blue-500/[0.02] p-6 shadow-inner">
                 <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-400/60 flex items-center gap-2">
                       <ShieldCheckIcon className="h-3 w-3" /> Provable Truth Matrix
                    </h3>
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                 </div>
                 
                 <div className="space-y-3 font-mono text-[10px]">
                    <div className="flex flex-col gap-1">
                       <span className="text-white/20 uppercase">Subject Address</span>
                       <span className="truncate text-white/60">{onChainBet?.player ?? localBet?.player ?? "—"}</span>
                    </div>
                    <div className="flex justify-between">
                       <span className="text-white/20 uppercase">Release ID</span>
                       <span className="text-blue-300/80">{shortHex(release?.releaseDigest)}</span>
                    </div>
                    <div className="flex justify-between">
                       <span className="text-white/20 uppercase">Primary Hash</span>
                       <span className="text-blue-300/80 cursor-pointer hover:text-blue-300 transition-colors">{shortHex(primaryTxHash)}</span>
                    </div>
                 </div>
              </div>

              {/* Interventions: Protocol Actions */}
              {(canFinalize || canRefund) && (
                <div className="relative z-10 mt-10 pt-8 border-t border-white/10">
                   <div className="flex flex-col gap-6">
                      <div className="flex items-center justify-between">
                         <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/30">Protocol Intervention</h3>
                         <TxStatusChip status={actionFlow?.status ?? 'idle'} />
                      </div>
                      
                      <div className="flex gap-4">
                         {canFinalize && (
                           <button 
                             onClick={() => void handleFinalize()} 
                             disabled={finalizeFlow.busy || refundFlow.busy}
                             className="flex-1 rounded-2xl bg-blue-500 py-4 font-bold text-black transition-all hover:bg-blue-400 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] active:scale-[0.98] disabled:opacity-50"
                           >
                             {finalizeFlow.busy ? "Finalizing..." : "Finalize Receipt"}
                           </button>
                         )}
                         {canRefund && (
                           <button 
                             onClick={() => void handleRefund()} 
                             disabled={refundFlow.busy || finalizeFlow.busy}
                             className="flex-1 rounded-2xl bg-rose-500 py-4 font-bold text-black transition-all hover:bg-rose-400 hover:shadow-[0_0_20px_rgba(244,63,94,0.4)] active:scale-[0.98] disabled:opacity-50"
                           >
                             {refundFlow.busy ? "Refunding..." : "Refund Stake"}
                           </button>
                         )}
                      </div>
                      
                      {actionFlow?.hasActivity && (
                        <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.01] p-4 text-white">
                           <TxStepper 
                             steps={actionFlow.steps} 
                             title="Action Trace" 
                             footer={<Button variant="ghost" size="sm" onClick={actionFlow.reset} className="text-[10px] text-white/30 p-0 h-auto">Clear Trace</Button>} 
                           />
                        </div>
                      )}
                   </div>
                </div>
              )}
           </div>

           {/* Receipt Decoration: Bottom Cutout */}
           <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="w-4 h-4 rounded-full bg-[#000] -translate-y-1/2" />
              ))}
           </div>
        </div>
        
        {/* Footer Audit Quote */}
        <p className="mt-12 text-[10px] font-mono font-bold uppercase tracking-[0.4em] text-white/20">
           Immutable Settlement Receipt • Sector_01_Hub
        </p>

      </main>
    </PageTransition>
  );
}

function mapTimelineStatus(eventName: string) {
  switch (eventName) {
    case "BetPlaced":
      return "placed" as const;
    case "BetRandomReady":
      return "pending" as const;
    case "BetFinalized":
      return "settled" as const;
    case "BetRefunded":
      return "cancelled" as const;
    default:
      return "pending" as const;
  }
}
