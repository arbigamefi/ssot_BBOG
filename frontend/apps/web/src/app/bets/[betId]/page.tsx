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

  return (
    <PageTransition pageKey={`bet-${betId ?? "unknown"}`}>
      <div className="space-y-8">
        <PageHeader
          title={`Bet #${betId ?? "—"}`}
          description={
            gameMeta
              ? `${gameMeta.label} · ${assetMeta?.symbol ?? shortHex(assetAddress)} · event-auditable detail`
              : `${assetMeta?.symbol ?? shortHex(assetAddress)} · event-auditable detail`
          }
          actions={
            <Button asChild variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:text-white">
              <Link href="/bets">Back to Bets</Link>
            </Button>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Status" value={betState ?? "—"} subValue={gameMeta?.label} />
          <StatCard
            label="Stake"
            value={onChainBet ? formatTokenAmount(onChainBet.stake, decimals, symbol) : "—"}
            subValue={assetMeta?.symbol}
          />
          <StatCard
            label="VRF Fee"
            value={onChainBet ? formatTokenAmount(onChainBet.vrfFeePaid, decimals, symbol) : "—"}
            subValue={primaryTxHash ? shortHex(primaryTxHash) : undefined}
          />
          <StatCard
            label={outcome?.label ?? "Lifecycle"}
            value={
              outcome
                ? formatTokenAmount(outcome.value, decimals, symbol)
                : betState === "randomReady"
                  ? "Awaiting finalize"
                  : betState === "placed"
                    ? "Awaiting VRF"
                    : "—"
            }
            subValue={onChainBet?.placedAt ? formatTimestamp(onChainBet.placedAt) : undefined}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="space-y-6">
            <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white">Summary</CardTitle>
                <CardDescription className="text-slate-400">
                  {isLoading
                    ? "Loading live bet state..."
                    : onChainBet
                      ? "Live on-chain data from Hub.getBet() with local fact-store enrichment."
                      : localBet
                        ? "Fallback to indexed facts because the live read is unavailable."
                        : "No bet data is currently available."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Metric label="Game" value={gameMeta?.label ?? shortHex(gameId)} />
                <Metric label="Game ID" value={gameId ?? "—"} copyable />
                <Metric
                  label="Asset"
                  value={assetAddress ? `${assetAddress}${symbol ? ` (${symbol})` : ""}` : "—"}
                  copyable
                  href={explorerBaseUrl && assetAddress ? `${explorerBaseUrl}/address/${assetAddress}` : undefined}
                />
                <Metric
                  label="Player"
                  value={onChainBet?.player ?? localBet?.player ?? "—"}
                  copyable
                  href={explorerBaseUrl && (onChainBet?.player ?? localBet?.player) ? `${explorerBaseUrl}/address/${onChainBet?.player ?? localBet?.player}` : undefined}
                />
                <Metric label="Placed At" value={onChainBet?.placedAt ? formatTimestamp(onChainBet.placedAt) : "—"} />
                <Metric label="Local Updated" value={localBet?.updatedAt ? formatTimestamp(localBet.updatedAt) : "—"} />
                <Metric label="Current State" value={betState ?? "—"} />
                <Metric label="Last Event" value={localBet?.lastEventName ?? timeline[timeline.length - 1]?.eventName ?? "—"} />
                <Metric
                  label="Primary Tx"
                  value={primaryTxHash ?? "—"}
                  copyable
                  href={explorerBaseUrl && primaryTxHash ? `${explorerBaseUrl}/tx/${primaryTxHash}` : undefined}
                />
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white">Timeline</CardTitle>
                <CardDescription className="text-slate-400">
                  Event-derived lifecycle from the local facts store.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {timelineLoading ? (
                  <p className="text-sm text-slate-500">Loading timeline...</p>
                ) : timeline.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No local Hub events found for this bet yet. Run a sync if the bet was placed recently.
                  </p>
                ) : (
                  timeline.map((event) => (
                    <div key={event.id} className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <StatusBadge status={mapTimelineStatus(event.eventName)} label={event.eventName} />
                          <span className="text-sm text-slate-300">Block {event.blockNumber}</span>
                        </div>
                        <span className="text-xs text-slate-500">{formatRelativeTime(event.createdAt)}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span className="font-mono">{shortHex(event.txHash)}</span>
                        {explorerBaseUrl ? (
                          <a
                            href={`${explorerBaseUrl}/tx/${event.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-300 transition-colors hover:text-emerald-200"
                          >
                            View tx
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {betState ? (
              <TxStepper
                title="Lifecycle"
                subtitle={`Current state: ${betState}`}
                steps={buildLifecycleSteps(betState)}
              />
            ) : null}

            <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white">Protocol Context</CardTitle>
                <CardDescription className="text-slate-400">
                  Release-scoped metadata used to interpret this bet.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Metric label="Release Digest" value={release?.releaseDigest ?? "—"} copyable />
                <Metric label="Hub" value={release?.contracts.hub ?? "—"} copyable />
                <Metric label="Game Label" value={gameMeta?.label ?? "—"} />
                <Metric label="Route Slug" value={gameMeta?.slug ?? "—"} />
                <Metric label="Params Encoding" value={gameMeta?.paramsEncoding ?? "Not declared"} />
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white">Actions</CardTitle>
                <CardDescription className="text-slate-400">
                  Refund and finalize are available only when the current lifecycle state allows them.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="destructive"
                    onClick={() => void handleRefund()}
                    disabled={!canRefund || refundFlow.busy || finalizeFlow.busy}
                  >
                    {refundFlow.busy ? "Running..." : "Refund"}
                  </Button>
                  <Button
                    onClick={() => void handleFinalize()}
                    disabled={!canFinalize || finalizeFlow.busy || refundFlow.busy}
                  >
                    {finalizeFlow.busy ? "Running..." : "Finalize"}
                  </Button>
                </div>
                {readOnly ? (
                  <p className="text-sm text-amber-400/80">Read-only mode is active, so write actions are disabled.</p>
                ) : null}
                {!canRefund && !canFinalize ? (
                  <p className="text-sm text-slate-500">
                    No write action is currently available for the observed state.
                  </p>
                ) : null}
                {actionError ? (
                  <ErrorCallout
                    title="Action error"
                    message={actionError.message}
                    details={serializeErrorDetails(actionError)}
                  />
                ) : null}
                {actionFlow ? (
                  <div className="space-y-3 rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{actionTitle}</div>
                        <div className="text-xs text-slate-400">{actionSubtitle}</div>
                      </div>
                      <TxStatusChip status={actionFlow.status} />
                    </div>
                    <TxStepper
                      title={actionTitle}
                      subtitle={`Status: ${actionFlow.status}`}
                      steps={actionFlow.steps}
                      footer={
                        <div className="space-y-2 text-xs text-slate-400">
                          {actionFlow.txHash ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono">{actionFlow.txHash}</span>
                              {explorerBaseUrl ? (
                                <a
                                  href={`${explorerBaseUrl}/tx/${actionFlow.txHash}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-emerald-300 transition-colors hover:text-emerald-200"
                                >
                                  View tx
                                </a>
                              ) : null}
                            </div>
                          ) : null}
                          {actionFlow.journalEntry?.blockNumber ? (
                            <div>Block: {actionFlow.journalEntry.blockNumber}</div>
                          ) : null}
                          {actionFlow.hasActivity ? (
                            <div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={actionFlow.reset}
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
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
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
