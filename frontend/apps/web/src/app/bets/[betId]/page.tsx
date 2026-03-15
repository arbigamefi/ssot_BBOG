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
} from "@ssot/ui";

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
    if (betState === "finalized" && onChainBet && onChainBet.payout != null) {
       return onChainBet.payout > onChainBet.stake ? "won" : "lost";
    }
    return betState;
  }, [betState, onChainBet]);

  return (
    <PageTransition pageKey={`bet-${betId ?? "unknown"}`}>
      <main className="max-w-2xl mx-auto px-6 py-12 md:py-24">
        
        <Link href="/bets" className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors font-bold text-sm mb-8">
           <span>←</span> Back to Tickets
        </Link>
        
        {/* Receipt Container */}
        <GlassCard 
          glowColor={resultState === 'won' ? "bg-green-500/20" : resultState === 'lost' ? "bg-white/10" : "bg-blue-500/20"} 
          glowPosition="top-left" 
          padding="xl" 
          className={`border-t-4 relative shadow-2xl ${
            resultState === 'won' ? 'border-t-green-500 shadow-green-500/10' : 
            resultState === 'lost' ? 'border-t-white/20' : 
            'border-t-blue-500 shadow-blue-500/10'
          }`}
        >
           
           {/* Decorative watermark */}
           {resultState === 'won' && (
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[120px] font-bold text-white/[0.02] pointer-events-none select-none rotate-12">
               WON
             </div>
           )}
           {resultState === 'lost' && (
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[120px] font-bold text-white/[0.02] pointer-events-none select-none rotate-12">
               LOST
             </div>
           )}

           {/* Header */}
           <div className="flex flex-col items-center justify-center border-b border-white/10 pb-8 mb-8 relative z-10">
              <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-4 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                Ticket #{betId ?? "—"}
              </span>
              <h1 className="text-3xl font-bold mb-2 text-white">{gameMeta?.label ?? "ArbiGameFi Room"}</h1>
              <span className={`font-bold px-3 py-1 rounded-md text-sm border uppercase tracking-widest ${
                resultState === 'won' ? 'text-green-400 bg-green-500/10 border-green-500/20' :
                resultState === 'lost' ? 'text-white/40 bg-white/5 border-white/10' :
                'text-blue-400 bg-blue-500/10 border-blue-500/20 animate-pulse'
              }`}>
                {resultState ?? "Pending"}
              </span>
           </div>

           {/* Core Figures */}
           <div className="grid grid-cols-2 gap-4 mb-8 bg-[#050505] p-6 rounded-2xl border border-white/5 relative z-10">
              <div className="flex flex-col">
                 <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Wager Amount</span>
                 <span className="text-2xl font-mono font-bold mt-1 text-white">
                   {onChainBet ? formatTokenAmount(onChainBet.stake, decimals, symbol) : "—"}
                 </span>
              </div>
              <div className="flex flex-col items-end">
                 <span className={`${resultState === 'won' ? 'text-green-500/80' : 'text-white/40'} text-xs font-bold uppercase tracking-widest`}>
                   Gross Payout
                 </span>
                 <span className={`text-2xl font-mono font-bold mt-1 ${resultState === 'won' ? 'text-green-400' : 'text-white/40'}`}>
                   {outcome ? formatTokenAmount(outcome.value, decimals, symbol) : "--"}
                 </span>
              </div>
           </div>

           {/* Parameters / Summary Items */}
           <div className="flex flex-col gap-4 border-b border-white/10 pb-8 mb-8 relative z-10">
              <h3 className="text-sm font-bold text-white/60 uppercase tracking-widest">Wager Details</h3>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-white/40">Asset</span>
                <span className="font-mono text-white text-right">{symbol || shortHex(assetAddress)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-white/40">Timestamp</span>
                <span className="font-mono text-white text-right">{onChainBet?.placedAt ? formatTimestamp(onChainBet.placedAt) : "—"}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-white/40">Lifecycle</span>
                <span className="font-mono text-white text-right truncate max-w-[140px]">{localBet?.lastEventName ?? "Awaiting..."}</span>
              </div>
           </div>

           {/* Provable Truth Matrix */}
           <div className="flex flex-col gap-4 relative z-10">
              <h3 className="text-sm font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
                 Provable Truth 
                 <span className={`w-2 h-2 rounded-full ${resultState === 'finalized' || resultState === 'won' || resultState === 'lost' ? 'bg-blue-500' : 'bg-white/20'}`}></span>
              </h3>
              
              <div className="flex flex-col p-4 bg-white/5 border border-white/10 rounded-xl font-mono text-xs gap-3 text-white/60">
                 <div className="flex flex-col gap-1">
                   <span className="text-blue-400/60 font-sans text-[10px] uppercase font-bold tracking-wider">Player Address</span>
                   <span className="font-bold text-white text-sm bg-white/5 w-fit px-2 py-1 rounded inline-block truncate max-w-full">
                     {onChainBet?.player ?? localBet?.player ?? "—"}
                   </span>
                 </div>
                 
                 <div className="w-full h-px bg-white/5 my-1" />

                 <div className="flex justify-between">
                   <span>Release Digest</span>
                   <span className="text-white truncate max-w-[120px]">{shortHex(release?.releaseDigest)}</span>
                 </div>
                 <div className="flex justify-between">
                   <span>Hub Contract</span>
                   <span className="text-blue-400 cursor-pointer hover:underline">{shortHex(release?.contracts.hub)}</span>
                 </div>
                 <div className="flex justify-between">
                   <span>Primary Tx</span>
                   <span className="text-blue-400 cursor-pointer hover:underline">{shortHex(primaryTxHash)}</span>
                 </div>
              </div>
           </div>

           {/* Finalize/Refund Actions */}
           {(canFinalize || canRefund) && (
             <div className="mt-10 pt-8 border-t border-white/10 relative z-10">
                <div className="flex flex-col gap-4">
                   <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white/60 uppercase tracking-widest">Protocol Intervention</h3>
                      <TxStatusChip status={actionFlow?.status ?? 'idle'} />
                   </div>
                   
                   <div className="flex gap-2">
                      {canFinalize && (
                        <Button 
                          onClick={() => void handleFinalize()} 
                          disabled={finalizeFlow.busy || refundFlow.busy}
                          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all active:scale-95"
                        >
                          {finalizeFlow.busy ? "Finalizing..." : "Finalize Room"}
                        </Button>
                      )}
                      {canRefund && (
                        <Button 
                          variant="destructive"
                          onClick={() => void handleRefund()} 
                          disabled={refundFlow.busy || finalizeFlow.busy}
                          className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl transition-all active:scale-95"
                        >
                          {refundFlow.busy ? "Refunding..." : "Refund Stake"}
                        </Button>
                      )}
                   </div>
                   
                   {actionError && (
                     <p className="text-xs text-rose-500 mt-2">{actionError.message}</p>
                   )}
                   
                   {actionFlow?.hasActivity && (
                     <div className="mt-4">
                        <TxStepper steps={actionFlow.steps} title="Governance Trace" footer={<Button variant="ghost" size="sm" onClick={actionFlow.reset} className="text-[10px] text-white/30 p-0 h-auto">Reset</Button>} />
                     </div>
                   )}
                </div>
             </div>
           )}

        </GlassCard>

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
