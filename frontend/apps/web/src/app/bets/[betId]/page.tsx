"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { DomainBet } from "@ssot/ssot";
import type { HubEventRow } from "@ssot/ssot/indexer";
import {
  AuditTabs,
  AuditTableCell,
  AuditTableHeader,
  Button,
  CopyButton,
  TxStatusChip,
  TxStepper,
  type StepState,
  type TxStepItem,
  cn,
  toast
} from "@ssot/ui";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

import { PageTransition } from "../../../components/PageTransition";
import { TrustStatsStrip } from "../../../components/TrustStatsStrip";
import { TrustTableShell } from "../../../components/TrustTableShell";
import { formatUnits } from "../../../features/betting/model/units";
import { useDirectTxAction } from "../../../features/tx/useDirectTxAction";
import { useRelease } from "../../../ssot/release/ReleaseProvider";
import { useSSOTRuntime } from "../../../ssot/runtime";
import { useSSOTSDK } from "../../../ssot/sdk";

function shortHex(value?: string) {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
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

function formatTimestamp(value?: number) {
  if (!value) return "—";
  const millis = value > 1_000_000_000_000 ? value : value * 1000;
  return new Date(millis).toLocaleString();
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
      { title: "Refunded", description: "Stake returned to the player", state: "done" }
    ];
  }
  return [
    { title: "Placed", state: stateToStep(state, "placed") },
    {
      title: "Random Ready",
      description: "VRF delivered a random word",
      state: stateToStep(state, "randomReady")
    },
    {
      title: "Finalized",
      description: "Bet settled on the Hub",
      state: stateToStep(state, "finalized")
    }
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

function RelativeMetric({
  label,
  value,
  copyValue,
  href
}: {
  label: string;
  value: string;
  copyValue?: string;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
      <span className="text-sm text-white/46">{label}</span>
      <span className="inline-flex items-center gap-2 font-mono text-sm text-white">
        {href && value !== "—" ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-cyan-200 transition-colors hover:text-cyan-100"
          >
            {value}
          </a>
        ) : (
          <span>{value}</span>
        )}
        {copyValue && value !== "—" ? (
          <CopyButton value={copyValue} label={`Copy ${label.toLowerCase()}`} />
        ) : null}
      </span>
    </div>
  );
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
    refetchInterval: 2_000
  });

  const {
    data: onChainBet,
    isLoading: onChainLoading,
    refetch: refetchOnChain
  } = useQuery({
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
    refetchInterval: 5_000
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ["ssot", "bet", "timeline", chainId, betId],
    enabled: Boolean(db && betId),
    queryFn: async (): Promise<HubEventRow[]> => {
      if (!db || !betId) return [];
      const rows = await db.hubEvents.where("chainId").equals(chainId).toArray();
      return rows
        .filter((row) => matchesBetId(row.argsJson, betId))
        .sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);
    },
    refetchInterval: 2_000
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
    () =>
      release?.assets.find((asset) => asset.address.toLowerCase() === assetAddress?.toLowerCase()),
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
      confirm: "Confirm on-chain"
    },
    descriptions: {
      preflight: "Validate refund eligibility and simulate the Hub call.",
      submit: "Broadcast refund through the wallet client.",
      confirm: "Wait for receipt and journal reconciliation."
    }
  });

  const finalizeFlow = useDirectTxAction({
    action: "FINALIZE",
    labels: {
      preflight: "Preflight",
      submit: "Submit finalize",
      confirm: "Confirm on-chain"
    },
    descriptions: {
      preflight: "Validate finalize eligibility and simulate the Hub call.",
      submit: "Broadcast finalize through the wallet client.",
      confirm: "Wait for receipt and journal reconciliation."
    }
  });

  const outcome = React.useMemo(() => {
    if (!onChainBet || !betState) return null;
    if (betState === "refunded")
      return { label: "Refunded", value: onChainBet.refund ?? onChainBet.stake };
    if (betState === "finalized" && onChainBet.payout != null) {
      return {
        label: onChainBet.payout >= onChainBet.stake ? "Net result" : "Loss",
        value: onChainBet.payout - onChainBet.stake
      };
    }
    return null;
  }, [betState, onChainBet]);

  const handleRefund = React.useCallback(async () => {
    if (!sdk || !betId) return;
    try {
      const result = await refundFlow.execute(() => sdk.hub.refund(BigInt(betId)));
      if (!result.ok) return;
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
      if (!result.ok) return;
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

  const actionTitle = actionFlow === refundFlow ? "Refund trace" : "Finalize trace";
  const resultState = React.useMemo(() => {
    if (betState === "finalized" && onChainBet?.payout != null) {
      return BigInt(onChainBet.payout) > BigInt(onChainBet.stake) ? "Won" : "Lost";
    }
    if (betState === "randomReady") return "Random ready";
    if (betState === "placed") return "Placed";
    if (betState === "refunded") return "Refunded";
    return betState ? `${betState.charAt(0).toUpperCase()}${betState.slice(1)}` : "Pending";
  }, [betState, onChainBet]);

  const timelineStatus = React.useCallback(
    (eventName: string): React.ComponentProps<typeof TxStatusChip>["status"] => {
      switch (eventName) {
        case "BetFinalized":
          return "reconciled";
        case "BetRefunded":
          return "failed";
        case "BetRandomReady":
          return "mined";
        default:
          return "submitting";
      }
    },
    []
  );

  return (
    <PageTransition pageKey={`bet-${betId ?? "unknown"}`}>
      <main className="mx-auto flex max-w-[1240px] flex-col gap-8 px-6 py-12 md:py-16">
        <Link
          href="/bets"
          className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-white/30 transition-colors hover:text-white"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to ledger
        </Link>

        <header className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/18 bg-emerald-400/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Network verified
          </div>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white md:text-5xl">
            {gameMeta?.label ?? "Ticket Detail"}
          </h1>
          <div className="mt-4 inline-flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-4 py-2 font-mono text-sm text-white/65">
            <span>TICKET_ID: #{betId ?? "—"}</span>
            {betId ? <CopyButton value={betId} label="Copy ticket id" /> : null}
          </div>
          <p className="mt-4 text-sm leading-7 text-white/48 md:text-[15px]">
            This receipt keeps stake, realized result, lifecycle proof, and any allowed protocol
            intervention in one compact dossier.
          </p>
        </header>

        <TrustStatsStrip
          items={[
            {
              label: "Settlement state",
              value: resultState,
              helper: isLoading
                ? "Refreshing state from the runtime."
                : "Current lifecycle state pulled from local and on-chain sources.",
              accent:
                betState === "finalized" ? "emerald" : betState === "refunded" ? "amber" : "cyan"
            },
            {
              label: "Capital at risk",
              value: onChainBet ? formatTokenAmount(onChainBet.stake, decimals, symbol) : "—",
              helper: "Original stake committed when the ticket was placed.",
              accent: "slate"
            },
            {
              label: "Gross settlement",
              value: outcome ? formatTokenAmount(outcome.value, decimals, symbol) : "—",
              helper: outcome?.label ?? "Outcome not yet settled.",
              accent: outcome && outcome.value > 0n ? "emerald" : "slate"
            },
            {
              label: "Receipt id",
              value: betId ? `#${betId}` : "—",
              helper: "Stable identifier used across runtime and indexer traces.",
              accent: "indigo"
            }
          ]}
        />

        <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
          <TrustTableShell
            eyebrow="Execution logic"
            title="Receipt matrix"
            description="Readable facts first: room, timestamps, wallet, and realized settlement."
          >
            <div className="space-y-3">
              <RelativeMetric label="Room" value={gameMeta?.label ?? "—"} />
              <RelativeMetric label="Ticket id" value={betId ?? "—"} copyValue={betId} />
              <RelativeMetric
                label="Capital at risk"
                value={onChainBet ? formatTokenAmount(onChainBet.stake, decimals, symbol) : "—"}
              />
              <RelativeMetric
                label="Gross settlement"
                value={outcome ? formatTokenAmount(outcome.value, decimals, symbol) : "—"}
              />
              <RelativeMetric
                label="Placed at"
                value={onChainBet?.placedAt ? formatTimestamp(Number(onChainBet.placedAt)) : "—"}
              />
              <RelativeMetric
                label="Primary tx"
                value={shortHex(primaryTxHash)}
                copyValue={primaryTxHash}
                href={
                  explorerBaseUrl && primaryTxHash
                    ? `${explorerBaseUrl}/tx/${primaryTxHash}`
                    : undefined
                }
              />
              <RelativeMetric
                label="Player"
                value={shortHex(onChainBet?.player ?? localBet?.player)}
                copyValue={onChainBet?.player ?? localBet?.player}
                href={
                  explorerBaseUrl && (onChainBet?.player ?? localBet?.player)
                    ? `${explorerBaseUrl}/address/${onChainBet?.player ?? localBet?.player}`
                    : undefined
                }
              />
            </div>
          </TrustTableShell>

          <div className="space-y-8">
            <TrustTableShell
              eyebrow="Provable truth"
              title="Lifecycle dossier"
              description="The runtime and indexer perspectives stay visible together so the receipt can be audited without jumping between views."
            >
              <div className="space-y-5">
                <TxStepper title="Lifecycle" steps={buildLifecycleSteps(betState ?? "placed")} />

                <div className="space-y-3">
                  <RelativeMetric
                    label="Release digest"
                    value={shortHex(release?.releaseDigest)}
                    copyValue={release?.releaseDigest}
                  />
                  <RelativeMetric label="Asset" value={symbol || "—"} />
                  <RelativeMetric
                    label="Latest indexed event"
                    value={
                      timeline[timeline.length - 1]?.eventName ?? localBet?.lastEventName ?? "—"
                    }
                  />
                </div>
              </div>
            </TrustTableShell>

            {(canFinalize || canRefund || actionFlow?.hasActivity) && (
              <TrustTableShell
                eyebrow="Protocol action"
                title={canRefund ? "Refund surface" : "Finalize surface"}
                description="Intervention buttons only appear when the lifecycle allows them. The trace stays attached to the same receipt."
              >
                <div className="space-y-5">
                  <div className="flex flex-wrap gap-3">
                    {canFinalize ? (
                      <button
                        type="button"
                        onClick={() => void handleFinalize()}
                        disabled={finalizeFlow.busy || refundFlow.busy}
                        className="flex-1 rounded-2xl bg-cyan-400 px-4 py-4 text-sm font-bold text-black transition-colors hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {finalizeFlow.busy ? "Finalizing..." : "Finalize ticket"}
                      </button>
                    ) : null}
                    {canRefund ? (
                      <button
                        type="button"
                        onClick={() => void handleRefund()}
                        disabled={refundFlow.busy || finalizeFlow.busy}
                        className="flex-1 rounded-2xl bg-amber-400 px-4 py-4 text-sm font-bold text-black transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {refundFlow.busy ? "Refunding..." : "Refund stake"}
                      </button>
                    ) : null}
                  </div>

                  {actionFlow?.hasActivity ? (
                    <>
                      <TxStatusChip status={actionFlow.status} />
                      <TxStepper
                        title={actionTitle}
                        steps={actionFlow.steps}
                        footer={
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={actionFlow.reset}
                            className="h-auto px-0 text-white/30 hover:text-white"
                          >
                            Clear trace
                          </Button>
                        }
                      />
                    </>
                  ) : null}
                </div>
              </TrustTableShell>
            )}
          </div>
        </div>

        <TrustTableShell
          eyebrow="Timeline"
          title="Indexed lifecycle events"
          description="A compact event stream tied specifically to this ticket id."
        >
          <AuditTabs
            className="mt-0 border-white/8 bg-black/20"
            activeColorClass="border-cyan-400/70 text-cyan-200"
            tabs={["Events"]}
            activeTab="Events"
          >
            <AuditTableHeader>
              <div className="grid grid-cols-[1fr_1fr_1fr_1fr_72px] gap-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                <div>Time / Tx</div>
                <div>Event</div>
                <div>Block</div>
                <div>Status</div>
                <div className="text-right">Flow</div>
              </div>
            </AuditTableHeader>

            <div className="flex min-h-[220px] flex-col gap-3">
              {timeline.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-white/8 bg-white/[0.02] py-16 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-white/28">
                  No indexed lifecycle events yet
                </div>
              ) : (
                timeline.map((row) => (
                  <div
                    key={`${row.txHash}-${row.logIndex}`}
                    className="rounded-[1.35rem] border border-white/8 bg-[linear-gradient(180deg,rgba(10,14,24,0.95),rgba(6,9,15,0.96))] p-4"
                  >
                    <div className="grid grid-cols-[1fr_1fr_1fr_1fr_72px] items-center gap-4">
                      <AuditTableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-semibold text-white">
                            {formatTimestamp(row.createdAt)}
                          </span>
                          <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/24">
                            {shortHex(row.txHash)}
                          </span>
                        </div>
                      </AuditTableCell>
                      <AuditTableCell>{row.eventName}</AuditTableCell>
                      <AuditTableCell>
                        <span className="font-mono text-sm text-white/72">{row.blockNumber}</span>
                      </AuditTableCell>
                      <AuditTableCell>
                        <TxStatusChip status={timelineStatus(row.eventName)} />
                      </AuditTableCell>
                      <AuditTableCell className="justify-end text-[11px] font-bold uppercase tracking-[0.18em] text-white/30">
                        Live
                      </AuditTableCell>
                    </div>
                  </div>
                ))
              )}
            </div>
          </AuditTabs>
        </TrustTableShell>
      </main>
    </PageTransition>
  );
}
