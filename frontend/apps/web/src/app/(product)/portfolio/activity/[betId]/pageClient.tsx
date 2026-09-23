"use client";

import { getCasinoCashReturned } from "@ssot/bet-index/financials";

import * as React from "react";
import { useTranslations } from "next-intl";
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
import { isTerminalDomainBet } from "../../../../../features/casino/room/resolution";
import { useDirectTxAction } from "../../../../../features/tx/useDirectTxAction";
import { useRelease } from "../../../../../ssot/release/ReleaseProvider";
import { useSSOTRuntime } from "../../../../../ssot/runtime";
import { useSSOTSDK } from "../../../../../ssot/sdk";

export function BetDetailPageClient({ betId }: { betId: string }) {
  const t = useTranslations();
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
    // A finalized or refunded bet is immutable, so polling it forever is a
    // provider request every few seconds that can never return anything new.
    // This is the only RPC-backed query on the page; the two Dexie queries
    // below read local IndexedDB and cost nothing.
    refetchInterval: (query) => (isTerminalDomainBet(query.state.data) ? false : 5_000)
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
  const cashReturned = getCasinoCashReturned({
    state: betState ?? undefined,
    stake: onChainBet?.stake ?? localBet?.stake,
    payout: settlementProof?.payoutNet ?? onChainBet?.payout,
    refundAmount:
      betState === "refunded"
        ? (refundProof?.refundAmount ?? onChainBet?.refund)
        : (settlementProof?.refundAmount ?? onChainBet?.refund)
  });
  const stateLabels = React.useMemo(
    () => ({
      won: t("portfolio.activity.detail.state.won"),
      lost: t("portfolio.activity.detail.state.lost"),
      settled: t("casino.room.receipt.status.finalized"),
      randomReady: t("portfolio.activity.detail.state.randomReady"),
      placed: t("portfolio.activity.detail.state.placed"),
      refunded: t("portfolio.activity.detail.state.refunded"),
      pending: t("portfolio.activity.detail.state.pending")
    }),
    [t]
  );
  const stateLabel =
    betState === "finalized" && cashReturned != null && onChainBet
      ? cashReturned > onChainBet.stake
        ? stateLabels.won
        : cashReturned < onChainBet.stake
          ? stateLabels.lost
          : stateLabels.settled
      : getStateLabel(betState, onChainBet, stateLabels);
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

  const emptyLabel = t("portfolio.activity.detail.common.empty");
  const gameLabel = gameMeta?.label ?? t("portfolio.activity.detail.common.ticketDetail");
  const symbol = assetMeta?.symbol ?? "";
  const decimals = assetMeta?.decimals ?? 18;
  const explorerBaseUrl = React.useMemo(() => getExplorerBaseUrl(chainId), [chainId]);
  const primaryTxHash = localBet?.lastTxHash ?? timeline[timeline.length - 1]?.txHash;
  const isLoading = localLoading || onChainLoading;

  const refundFlow = useDirectTxAction({
    action: "REFUND",
    errorMessage: t("app.errors.transactionFailed"),
    labels: {
      preflight: t("portfolio.activity.detail.flows.preflight"),
      submit: t("portfolio.activity.detail.flows.refund.submit"),
      confirm: t("portfolio.activity.detail.flows.confirm")
    },
    descriptions: {
      preflight: t("portfolio.activity.detail.flows.refund.preflight"),
      submit: t("portfolio.activity.detail.flows.refund.broadcast"),
      confirm: t("portfolio.activity.detail.flows.receipt")
    }
  });

  const manualFinalizeFlow = useDirectTxAction({
    action: "FINALIZE",
    errorMessage: t("app.errors.transactionFailed"),
    labels: {
      preflight: t("portfolio.activity.detail.flows.preflight"),
      submit: t("portfolio.activity.detail.flows.finalize.submit"),
      confirm: t("portfolio.activity.detail.flows.confirm")
    },
    descriptions: {
      preflight: t("portfolio.activity.detail.flows.finalize.preflight"),
      submit: t("portfolio.activity.detail.flows.finalize.broadcast"),
      confirm: t("portfolio.activity.detail.flows.receipt")
    }
  });

  const canRefund = betState === "placed" && !readOnly && Boolean(sdk?.account);
  const canFinalize = betState === "randomReady" && !readOnly && Boolean(sdk?.account);

  const handleRefund = React.useCallback(async () => {
    if (!sdk || parsedBetId === undefined) return;
    try {
      const result = await refundFlow.execute(() => sdk.gameHub.refund(parsedBetId));
      if (!result.ok) return;
      toast.success(t("portfolio.activity.detail.toast.refunded"));
      void refetchOnChain();
    } catch (error) {
      toast.error((error as Error).message ?? t("portfolio.activity.detail.toast.refundFailed"));
    }
  }, [parsedBetId, refetchOnChain, refundFlow, sdk, t]);

  const manualFinalizeHandler = React.useCallback(async () => {
    if (!sdk || parsedBetId === undefined) return;
    try {
      const result = await manualFinalizeFlow.execute(() => sdk.gameHub.finalize(parsedBetId));
      if (!result.ok) return;
      toast.success(t("portfolio.activity.detail.toast.finalized"));
      void refetchOnChain();
    } catch (error) {
      toast.error((error as Error).message ?? t("portfolio.activity.detail.toast.finalizeFailed"));
    }
  }, [manualFinalizeFlow, parsedBetId, refetchOnChain, sdk, t]);

  const outcome = React.useMemo(
    () =>
      deriveOutcome(onChainBet, betState, settlementProof, refundProof, {
        refunded: t("portfolio.activity.detail.outcomes.refunded"),
        netResult: t("portfolio.activity.detail.outcomes.netResult"),
        loss: t("portfolio.activity.detail.outcomes.loss")
      }),
    [betState, onChainBet, refundProof, settlementProof, t]
  );

  const metrics = React.useMemo<BetDetailMetric[]>(
    () => [
      {
        label: t("portfolio.activity.detail.metrics.settlementState.label"),
        value: isLoading ? t("portfolio.activity.detail.state.refreshing") : stateLabel,
        detail: t("portfolio.activity.detail.metrics.settlementState.detail"),
        tone:
          betState === "finalized"
            ? outcome?.value != null && outcome.value >= 0n
              ? "success"
              : "danger"
            : "brand"
      },
      {
        label: t("portfolio.activity.detail.metrics.capitalAtRisk.label"),
        value: formatTokenAmount(onChainBet?.stake, decimals, symbol, 4, emptyLabel),
        detail: t("portfolio.activity.detail.metrics.capitalAtRisk.detail")
      },
      {
        label: outcome?.label ?? t("portfolio.activity.detail.metrics.settlement.label"),
        value: formatTokenAmount(outcome?.value, decimals, symbol, 4, emptyLabel),
        detail: outcome
          ? t("portfolio.activity.detail.metrics.settlement.realized")
          : t("portfolio.activity.detail.metrics.settlement.pending"),
        tone:
          outcome?.value != null && outcome.value >= 0n ? "success" : outcome ? "danger" : "default"
      },
      {
        label: t("portfolio.activity.detail.metrics.receiptId.label"),
        value: `#${betId}`,
        detail: t("portfolio.activity.detail.metrics.receiptId.detail")
      }
    ],
    [
      betId,
      betState,
      decimals,
      emptyLabel,
      isLoading,
      onChainBet?.stake,
      outcome,
      stateLabel,
      symbol,
      t
    ]
  );

  const receiptFacts = React.useMemo<BetDetailFact[]>(
    () => [
      { label: t("portfolio.activity.detail.facts.room"), value: gameLabel },
      { label: t("portfolio.activity.detail.facts.ticketId"), value: betId, copyValue: betId },
      {
        label: t("portfolio.activity.detail.facts.stake"),
        value: formatTokenAmount(onChainBet?.stake, decimals, symbol, 4, emptyLabel)
      },
      {
        label: t("portfolio.activity.detail.facts.vrfFeePaid"),
        value: formatNativeAmount(onChainBet?.vrfFeePaid)
      },
      {
        label: t("portfolio.activity.detail.facts.vrfFeeCharged"),
        value: formatNativeAmount(onChainBet?.vrfFeeCharged)
      },
      {
        label: t("portfolio.activity.detail.facts.vrfRequestId"),
        value: formatBigintId(onChainBet?.requestId),
        copyValue: copyableBigintId(onChainBet?.requestId)
      },
      {
        label: t("portfolio.activity.detail.facts.randomHash"),
        value: shortHex(nonZeroHex(onChainBet?.randomHash), emptyLabel),
        copyValue: nonZeroHex(onChainBet?.randomHash)
      },
      {
        label: t("portfolio.activity.detail.facts.payout"),
        value: formatTokenAmount(cashReturned, decimals, symbol, 4, emptyLabel)
      },
      {
        label: t("portfolio.activity.detail.facts.protocolFee"),
        value: formatTokenAmount(
          settlementProof?.protocolFeeAccrual,
          decimals,
          symbol,
          4,
          emptyLabel
        )
      },
      {
        label: t("portfolio.activity.detail.facts.refund"),
        value: formatTokenAmount(
          refundProof?.refundAmount ?? onChainBet?.refund,
          decimals,
          symbol,
          4,
          emptyLabel
        )
      },
      {
        label: t("portfolio.activity.detail.facts.placedAt"),
        value: formatTimestamp(onChainBet?.placedAt, emptyLabel)
      },
      {
        label: t("portfolio.activity.detail.facts.vrfRequestedAt"),
        value: formatTimestamp(onChainBet?.vrfRequestedAt, emptyLabel)
      },
      {
        label: t("portfolio.activity.detail.facts.settledAt"),
        value: formatTimestamp(onChainBet?.resolvedAt ?? onChainBet?.settledAt, emptyLabel)
      },
      {
        label: t("portfolio.activity.detail.facts.primaryTx"),
        value: shortHex(primaryTxHash, emptyLabel),
        copyValue: primaryTxHash,
        href:
          explorerBaseUrl && primaryTxHash ? `${explorerBaseUrl}/tx/${primaryTxHash}` : undefined
      },
      {
        label: t("portfolio.activity.detail.facts.player"),
        value: shortHex(onChainBet?.player ?? localBet?.player, emptyLabel),
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
      emptyLabel,
      explorerBaseUrl,
      gameLabel,
      localBet?.player,
      onChainBet,
      primaryTxHash,
      refundProof?.refundAmount,
      cashReturned,
      settlementProof?.protocolFeeAccrual,
      symbol,
      t
    ]
  );

  const lifecycleFacts = React.useMemo<BetDetailFact[]>(
    () => [
      {
        label: t("portfolio.activity.detail.lifecycle.releaseDigest"),
        value: shortHex(release?.releaseDigest, emptyLabel)
      },
      {
        label: t("portfolio.activity.detail.lifecycle.asset"),
        value: symbol || shortHex(assetAddress, emptyLabel)
      },
      {
        label: t("portfolio.activity.detail.lifecycle.latestIndexedEvent"),
        value: timeline[timeline.length - 1]?.eventName ?? localBet?.lastEventName ?? emptyLabel
      }
    ],
    [assetAddress, emptyLabel, localBet?.lastEventName, release?.releaseDigest, symbol, t, timeline]
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
  refundAmount?: bigint;
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
  refundProof?: RefundProof | null,
  labels: {
    refunded: string;
    netResult: string;
    loss: string;
  } = {
    refunded: "—",
    netResult: "—",
    loss: "—"
  }
) {
  if (!bet || !state) return null;
  if (state === "refunded")
    return { label: labels.refunded, value: refundProof?.refundAmount ?? bet.refund };
  const award = settlementProof?.payoutNet ?? bet.payout;
  const refund = settlementProof?.refundAmount ?? bet.refund;
  const payout = award != null && refund != null ? award + refund : undefined;
  if (state === "finalized" && payout != null) {
    return {
      label: payout >= bet.stake ? labels.netResult : labels.loss,
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
    refundAmount: readBigintArg(args.refundAmount),
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
