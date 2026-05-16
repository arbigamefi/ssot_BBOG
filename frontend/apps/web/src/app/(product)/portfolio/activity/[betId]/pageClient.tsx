"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { DomainBet } from "@ssot/ssot";
import type { BetRow, GameHubEventRow } from "@ssot/ssot/indexer";
import { toast } from "@ssot/ui";

import { PageTransition } from "../../../../../components/PageTransition";
import { BetDetailActions } from "../../../../../features/portfolio/activity/detail/bet-detail-actions";
import { BetDetailFacts } from "../../../../../features/portfolio/activity/detail/bet-detail-facts";
import { BetDetailHero } from "../../../../../features/portfolio/activity/detail/bet-detail-hero";
import { BetDetailLifecycle } from "../../../../../features/portfolio/activity/detail/bet-detail-lifecycle";
import { BetDetailSummary } from "../../../../../features/portfolio/activity/detail/bet-detail-summary";
import { BetDetailTimeline } from "../../../../../features/portfolio/activity/detail/bet-detail-timeline";
import {
  formatNativeAmount,
  formatTimestamp,
  formatTokenAmount,
  getExplorerBaseUrl,
  shortHex
} from "../../../../../features/portfolio/activity/detail/format";
import {
  getStateLabel,
  matchesBetId
} from "../../../../../features/portfolio/activity/detail/lifecycle";
import type {
  BetDetailFact,
  BetDetailMetric
} from "../../../../../features/portfolio/activity/detail/types";
import { useDirectTxAction } from "../../../../../features/tx/useDirectTxAction";
import { useRelease } from "../../../../../ssot/release/ReleaseProvider";
import { useSSOTRuntime } from "../../../../../ssot/runtime";
import { useSSOTSDK } from "../../../../../ssot/sdk";

export function BetDetailPageClient({ betId }: { betId: string }) {
  const { db } = useSSOTRuntime();
  const { sdk } = useSSOTSDK();
  const { chainId, readOnly, release } = useRelease();

  const parsedBetId = React.useMemo(() => parseBetId(betId), [betId]);

  const { data: localBet, isLoading: localLoading } = useQuery({
    queryKey: ["ssot", "bet", chainId, betId],
    enabled: Boolean(db && betId),
    queryFn: async (): Promise<BetRow | null> => {
      if (!db || !betId) return null;
      return (await db.bets.get(`${chainId}:${betId}`)) ?? null;
    },
    refetchInterval: 2_000
  });

  const {
    data: onChainBet,
    isLoading: onChainLoading,
    refetch: refetchOnChain
  } = useQuery({
    queryKey: ["ssot", "getBet", chainId, betId],
    enabled: Boolean(sdk && parsedBetId !== undefined),
    queryFn: async (): Promise<DomainBet | null> => {
      if (!sdk || parsedBetId === undefined) return null;
      try {
        return await sdk.gameHub.getBet(parsedBetId);
      } catch {
        return null;
      }
    },
    refetchInterval: 5_000
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ["ssot", "bet", "timeline", chainId, betId],
    enabled: Boolean(db && betId),
    queryFn: async (): Promise<GameHubEventRow[]> => {
      if (!db || !betId) return [];
      const rows = await db.gameHubEvents.where("chainId").equals(chainId).toArray();
      return rows
        .filter((row) => matchesBetId(row.argsJson, betId))
        .sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);
    },
    refetchInterval: 2_000
  });

  const settlementProof = React.useMemo(() => extractSettlementProof(timeline), [timeline]);
  const refundProof = React.useMemo(() => extractRefundProof(timeline), [timeline]);
  const betState = onChainBet?.state ?? localBet?.state ?? null;
  const stateLabel =
    betState === "finalized" && settlementProof?.payoutNet != null
      ? settlementProof.payoutNet >= (onChainBet?.stake ?? 0n)
        ? "Won"
        : "Lost"
      : getStateLabel(betState, onChainBet);
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

  const gameLabel = gameMeta?.label ?? "Ticket detail";
  const symbol = assetMeta?.symbol ?? "";
  const decimals = assetMeta?.decimals ?? 18;
  const explorerBaseUrl = React.useMemo(() => getExplorerBaseUrl(chainId), [chainId]);
  const primaryTxHash = localBet?.lastTxHash ?? timeline[timeline.length - 1]?.txHash;
  const isLoading = localLoading || onChainLoading;

  const refundFlow = useDirectTxAction({
    action: "REFUND",
    labels: {
      preflight: "Preflight",
      submit: "Submit refund",
      confirm: "Confirm on-chain"
    },
    descriptions: {
      preflight: "Validate refund eligibility and simulate the GameHub call.",
      submit: "Broadcast refund through the wallet client.",
      confirm: "Wait for receipt and journal reconciliation."
    }
  });

  const manualFinalizeFlow = useDirectTxAction({
    action: "FINALIZE",
    labels: {
      preflight: "Preflight",
      submit: "Submit finalize",
      confirm: "Confirm on-chain"
    },
    descriptions: {
      preflight: "Validate finalize eligibility and simulate the GameHub call.",
      submit: "Broadcast finalize through the wallet client.",
      confirm: "Wait for receipt and journal reconciliation."
    }
  });

  const canRefund = betState === "placed" && !readOnly && Boolean(sdk?.account);
  const canFinalize = betState === "randomReady" && !readOnly && Boolean(sdk?.account);

  const handleRefund = React.useCallback(async () => {
    if (!sdk || parsedBetId === undefined) return;
    try {
      const result = await refundFlow.execute(() => sdk.gameHub.refund(parsedBetId));
      if (!result.ok) return;
      toast.success("Bet refunded successfully");
      void refetchOnChain();
    } catch (error) {
      toast.error((error as Error).message ?? "Refund transaction failed");
    }
  }, [parsedBetId, refetchOnChain, refundFlow, sdk]);

  const manualFinalizeHandler = React.useCallback(async () => {
    if (!sdk || parsedBetId === undefined) return;
    try {
      const result = await manualFinalizeFlow.execute(() => sdk.gameHub.finalize(parsedBetId));
      if (!result.ok) return;
      toast.success("Bet finalized successfully");
      void refetchOnChain();
    } catch (error) {
      toast.error((error as Error).message ?? "Finalize transaction failed");
    }
  }, [manualFinalizeFlow, parsedBetId, refetchOnChain, sdk]);

  const outcome = React.useMemo(
    () => deriveOutcome(onChainBet, betState, settlementProof, refundProof),
    [betState, onChainBet, refundProof, settlementProof]
  );

  const metrics = React.useMemo<BetDetailMetric[]>(
    () => [
      {
        label: "Settlement state",
        value: isLoading ? "Refreshing" : stateLabel,
        detail: "Current lifecycle state from local and on-chain sources.",
        tone:
          betState === "finalized"
            ? outcome?.value != null && outcome.value >= 0n
              ? "success"
              : "danger"
            : "brand"
      },
      {
        label: "Capital at risk",
        value: formatTokenAmount(onChainBet?.stake, decimals, symbol),
        detail: "Original stake committed when the ticket was placed."
      },
      {
        label: outcome?.label ?? "Settlement",
        value: formatTokenAmount(outcome?.value, decimals, symbol),
        detail: outcome ? "Realized on-chain result." : "Outcome not settled yet.",
        tone:
          outcome?.value != null && outcome.value >= 0n ? "success" : outcome ? "danger" : "default"
      },
      {
        label: "Receipt id",
        value: `#${betId}`,
        detail: "Stable identifier used across runtime and indexer traces."
      }
    ],
    [betId, betState, decimals, isLoading, onChainBet?.stake, outcome, stateLabel, symbol]
  );

  const receiptFacts = React.useMemo<BetDetailFact[]>(
    () => [
      { label: "Room", value: gameLabel },
      { label: "Ticket id", value: betId, copyValue: betId },
      { label: "Stake", value: formatTokenAmount(onChainBet?.stake, decimals, symbol) },
      { label: "VRF fee paid", value: formatNativeAmount(onChainBet?.vrfFeePaid) },
      { label: "VRF fee charged", value: formatNativeAmount(onChainBet?.vrfFeeCharged) },
      {
        label: "VRF request id",
        value: formatBigintId(onChainBet?.requestId),
        copyValue: copyableBigintId(onChainBet?.requestId)
      },
      {
        label: "Random hash",
        value: shortHex(nonZeroHex(onChainBet?.randomHash)),
        copyValue: nonZeroHex(onChainBet?.randomHash)
      },
      {
        label: "Payout",
        value: formatTokenAmount(settlementProof?.payoutNet ?? onChainBet?.payout, decimals, symbol)
      },
      {
        label: "Protocol fee",
        value: formatTokenAmount(settlementProof?.protocolFeeAccrual, decimals, symbol)
      },
      {
        label: "Refund",
        value: formatTokenAmount(refundProof?.refundAmount ?? onChainBet?.refund, decimals, symbol)
      },
      { label: "Placed at", value: formatTimestamp(onChainBet?.placedAt) },
      { label: "VRF requested at", value: formatTimestamp(onChainBet?.vrfRequestedAt) },
      {
        label: "Settled at",
        value: formatTimestamp(onChainBet?.resolvedAt ?? onChainBet?.settledAt)
      },
      {
        label: "Primary tx",
        value: shortHex(primaryTxHash),
        copyValue: primaryTxHash,
        href:
          explorerBaseUrl && primaryTxHash ? `${explorerBaseUrl}/tx/${primaryTxHash}` : undefined
      },
      {
        label: "Player",
        value: shortHex(onChainBet?.player ?? localBet?.player),
        copyValue: onChainBet?.player ?? localBet?.player,
        href:
          explorerBaseUrl && (onChainBet?.player ?? localBet?.player)
            ? `${explorerBaseUrl}/address/${onChainBet?.player ?? localBet?.player}`
            : undefined
      }
    ],
    [
      betId,
      decimals,
      explorerBaseUrl,
      gameLabel,
      localBet?.player,
      onChainBet,
      primaryTxHash,
      refundProof?.refundAmount,
      settlementProof?.payoutNet,
      settlementProof?.protocolFeeAccrual,
      symbol
    ]
  );

  const lifecycleFacts = React.useMemo<BetDetailFact[]>(
    () => [
      { label: "Release digest", value: shortHex(release?.releaseDigest) },
      { label: "Asset", value: symbol || shortHex(assetAddress) },
      {
        label: "Latest indexed event",
        value: timeline[timeline.length - 1]?.eventName ?? localBet?.lastEventName ?? "—"
      }
    ],
    [assetAddress, localBet?.lastEventName, release?.releaseDigest, symbol, timeline]
  );

  return (
    <PageTransition pageKey={`bet-${betId}`}>
      <div className="space-y-8">
        <BetDetailHero betId={betId} gameLabel={gameLabel} stateLabel={stateLabel} />
        <BetDetailSummary metrics={metrics} />

        <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
          <BetDetailFacts facts={receiptFacts} />
          <div className="space-y-8">
            <BetDetailLifecycle state={betState} facts={lifecycleFacts} />
            <BetDetailActions
              canFinalize={canFinalize}
              canRefund={canRefund}
              finalizeFlow={manualFinalizeFlow}
              refundFlow={refundFlow}
              onFinalize={() => void manualFinalizeHandler()}
              onRefund={() => void handleRefund()}
              explorerBaseUrl={explorerBaseUrl}
            />
          </div>
        </div>

        <BetDetailTimeline timeline={timeline} />
      </div>
    </PageTransition>
  );
}

function parseBetId(value: string) {
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

interface SettlementProof {
  payoutGross?: bigint;
  payoutNet?: bigint;
  feeOnPayout?: bigint;
  protocolFeeAccrual?: bigint;
}

interface RefundProof {
  refundAmount?: bigint;
}

function deriveOutcome(
  bet?: DomainBet | null,
  state?: string | null,
  settlementProof?: SettlementProof | null,
  refundProof?: RefundProof | null
) {
  if (!bet || !state) return null;
  if (state === "refunded")
    return { label: "Refunded", value: refundProof?.refundAmount ?? bet.refund ?? bet.stake };
  const payout = settlementProof?.payoutNet ?? bet.payout;
  if (state === "finalized" && payout != null) {
    return {
      label: payout >= bet.stake ? "Net result" : "Loss",
      value: payout - bet.stake
    };
  }
  return null;
}

function extractSettlementProof(timeline: GameHubEventRow[]): SettlementProof | null {
  const row = [...timeline].reverse().find((event) => event.eventName === "BetFinalized");
  if (!row) return null;
  const args = parseArgs(row.argsJson);
  if (!args) return null;
  return {
    payoutGross: readBigintArg(args.payoutGross),
    payoutNet: readBigintArg(args.payoutNet),
    feeOnPayout: readBigintArg(args.feeOnPayout),
    protocolFeeAccrual: readBigintArg(args.protocolFeeAccrual)
  };
}

function extractRefundProof(timeline: GameHubEventRow[]): RefundProof | null {
  const row = [...timeline].reverse().find((event) => event.eventName === "BetRefunded");
  if (!row) return null;
  const args = parseArgs(row.argsJson);
  if (!args) return null;
  return {
    refundAmount: readBigintArg(args.refundAmount)
  };
}

function parseArgs(argsJson: string): Record<string, unknown> | null {
  try {
    return JSON.parse(argsJson) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readBigintArg(value: unknown): bigint | undefined {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") {
    if (!value) return undefined;
    try {
      return BigInt(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function formatBigintId(value?: bigint) {
  return value && value > 0n ? value.toString() : "—";
}

function copyableBigintId(value?: bigint) {
  return value && value > 0n ? value.toString() : undefined;
}

function nonZeroHex(value?: string | null) {
  if (!value || /^0x0+$/.test(value)) return undefined;
  return value;
}
