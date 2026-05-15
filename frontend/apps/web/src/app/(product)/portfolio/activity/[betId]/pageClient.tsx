"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { DomainBet } from "@ssot/ssot";
import type { BetRow, HubEventRow } from "@ssot/ssot/indexer";
import { toast } from "@ssot/ui";

import { PageTransition } from "../../../../../components/PageTransition";
import { BetDetailActions } from "../../../../../features/portfolio/activity/detail/bet-detail-actions";
import { BetDetailFacts } from "../../../../../features/portfolio/activity/detail/bet-detail-facts";
import { BetDetailHero } from "../../../../../features/portfolio/activity/detail/bet-detail-hero";
import { BetDetailLifecycle } from "../../../../../features/portfolio/activity/detail/bet-detail-lifecycle";
import { BetDetailSummary } from "../../../../../features/portfolio/activity/detail/bet-detail-summary";
import { BetDetailTimeline } from "../../../../../features/portfolio/activity/detail/bet-detail-timeline";
import {
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
        return await sdk.hub.getBet(parsedBetId);
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
  const stateLabel = getStateLabel(betState, onChainBet);
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

  const canRefund = betState === "placed" && !readOnly && Boolean(sdk?.account);
  const canFinalize = betState === "randomReady" && !readOnly && Boolean(sdk?.account);

  const handleRefund = React.useCallback(async () => {
    if (!sdk || parsedBetId === undefined) return;
    try {
      const result = await refundFlow.execute(() => sdk.hub.refund(parsedBetId));
      if (!result.ok) return;
      toast.success("Bet refunded successfully");
      void refetchOnChain();
    } catch (error) {
      toast.error((error as Error).message ?? "Refund transaction failed");
    }
  }, [parsedBetId, refetchOnChain, refundFlow, sdk]);

  const handleFinalize = React.useCallback(async () => {
    if (!sdk || parsedBetId === undefined) return;
    try {
      const result = await finalizeFlow.execute(() => sdk.hub.finalize(parsedBetId));
      if (!result.ok) return;
      toast.success("Bet finalized successfully");
      void refetchOnChain();
    } catch (error) {
      toast.error((error as Error).message ?? "Finalize transaction failed");
    }
  }, [finalizeFlow, parsedBetId, refetchOnChain, sdk]);

  const outcome = React.useMemo(() => deriveOutcome(onChainBet, betState), [betState, onChainBet]);

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
      { label: "VRF fee paid", value: formatTokenAmount(onChainBet?.vrfFeePaid, decimals, symbol) },
      { label: "Payout", value: formatTokenAmount(onChainBet?.payout, decimals, symbol) },
      { label: "Refund", value: formatTokenAmount(onChainBet?.refund, decimals, symbol) },
      { label: "Placed at", value: formatTimestamp(onChainBet?.placedAt) },
      { label: "Settled at", value: formatTimestamp(onChainBet?.settledAt) },
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
              finalizeFlow={finalizeFlow}
              refundFlow={refundFlow}
              onFinalize={() => void handleFinalize()}
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

function deriveOutcome(bet?: DomainBet | null, state?: string | null) {
  if (!bet || !state) return null;
  if (state === "refunded") return { label: "Refunded", value: bet.refund ?? bet.stake };
  if (state === "finalized" && bet.payout != null) {
    return {
      label: bet.payout >= bet.stake ? "Net result" : "Loss",
      value: bet.payout - bet.stake
    };
  }
  return null;
}
