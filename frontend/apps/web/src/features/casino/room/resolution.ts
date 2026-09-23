import * as React from "react";
import type { DomainBet } from "@ssot/ssot";
import type { GameHubTerminalProof, SSOTGameHubAPI } from "@ssot/ssot/sdk";
import type { SSOTDb } from "@ssot/ssot/indexer";

import {
  findIndexedBetById,
  isTerminalIndexedBet,
  readTerminalProof,
  type RefundProof,
  type SettlementProof,
  type TerminalProof,
  type IndexedBetSummary
} from "./reconciliation";

export type GameHistoryEntry = {
  val: number;
  win: boolean;
};

type CasinoRoundResultBase = {
  betId: bigint;
  requestId: bigint;
  randomHash: `0x${string}`;
  player: `0x${string}`;
  stake: bigint;
  vrfFeeCharged?: bigint;
  resolvedAt?: number;
};

type CompleteSettlementProof = SettlementProof & { payoutNet: bigint; refundAmount: bigint };
type CompleteRefundProof = RefundProof & { refundAmount: bigint };

export type CasinoRoundIndexingResult = CasinoRoundResultBase & {
  kind: "indexing";
  settlement?: SettlementProof;
  refund?: RefundProof;
};

export type CasinoRoundSettledResult = CasinoRoundResultBase & {
  kind: "settled";
  settlement: CompleteSettlementProof;
};

export type CasinoRoundRefundedResult = CasinoRoundResultBase & {
  kind: "refunded";
  refund: CompleteRefundProof;
};

export type CasinoTerminalRoundResult = CasinoRoundSettledResult | CasinoRoundRefundedResult;

export type CasinoRoundResult =
  | CasinoRoundIndexingResult
  | CasinoRoundSettledResult
  | CasinoRoundRefundedResult;

function hasCompleteSettlement(
  settlement: SettlementProof | undefined
): settlement is CompleteSettlementProof {
  return settlement?.payoutNet != null && settlement.refundAmount != null;
}

function hasCompleteRefund(refund: RefundProof | undefined): refund is CompleteRefundProof {
  return refund?.refundAmount != null;
}

export function isCasinoTerminalRoundResult(
  result: CasinoRoundResult | null | undefined
): result is CasinoTerminalRoundResult {
  if (result?.kind === "settled") return hasCompleteSettlement(result.settlement);
  if (result?.kind === "refunded") return hasCompleteRefund(result.refund);
  return false;
}

function buildIndexingRoundResult({
  bet,
  settlement,
  refund
}: {
  bet: DomainBet;
  settlement?: SettlementProof;
  refund?: RefundProof;
}): CasinoRoundIndexingResult {
  return {
    kind: "indexing",
    betId: bet.betId,
    requestId: bet.requestId,
    randomHash: bet.randomHash,
    player: bet.player,
    stake: bet.stake,
    vrfFeeCharged: bet.vrfFeeCharged,
    resolvedAt: bet.resolvedAt,
    settlement,
    refund
  };
}

function buildSettledRoundResult({
  bet,
  settlement
}: {
  bet: DomainBet;
  settlement: CompleteSettlementProof;
}): CasinoRoundSettledResult {
  return {
    kind: "settled",
    betId: bet.betId,
    requestId: bet.requestId,
    randomHash: bet.randomHash,
    player: bet.player,
    stake: bet.stake,
    vrfFeeCharged: bet.vrfFeeCharged,
    resolvedAt: bet.resolvedAt,
    settlement
  };
}

function buildRefundedRoundResult({
  bet,
  refund
}: {
  bet: DomainBet;
  refund: CompleteRefundProof;
}): CasinoRoundRefundedResult {
  return {
    kind: "refunded",
    betId: bet.betId,
    requestId: bet.requestId,
    randomHash: bet.randomHash,
    player: bet.player,
    stake: bet.stake,
    vrfFeeCharged: bet.vrfFeeCharged,
    resolvedAt: bet.resolvedAt,
    refund
  };
}

export function appendGameHistoryEntry(
  history: readonly GameHistoryEntry[],
  entry: GameHistoryEntry,
  limit = 5
) {
  return [entry, ...history].slice(0, limit);
}

export function isTerminalDomainBet(
  bet: DomainBet | null | undefined
): bet is DomainBet & { state: "finalized" | "refunded" } {
  return bet?.state === "finalized" || bet?.state === "refunded";
}

export function buildCasinoRoundResult({
  bet,
  settlement,
  refund
}: {
  bet: DomainBet;
  settlement?: SettlementProof;
  refund?: RefundProof;
}): CasinoRoundResult {
  if (bet.state === "refunded") {
    return hasCompleteRefund(refund)
      ? buildRefundedRoundResult({ bet, refund })
      : buildIndexingRoundResult({ bet, refund });
  }

  return hasCompleteSettlement(settlement)
    ? buildSettledRoundResult({ bet, settlement })
    : buildIndexingRoundResult({ bet, settlement });
}

export function isCompleteTerminalProof(
  proof: TerminalProof | GameHubTerminalProof | null | undefined
) {
  if (!proof) return false;
  if (proof.kind === "settled") return hasCompleteSettlement(proof.settlement);
  return proof.refund.refundAmount != null;
}

export async function resolveCasinoTerminalProof({
  terminalBet,
  recentBets,
  db,
  gameHub
}: {
  terminalBet: DomainBet;
  recentBets: readonly IndexedBetSummary[];
  db: Pick<SSOTDb, "gameHubEvents"> | undefined;
  gameHub: Pick<SSOTGameHubAPI, "getTerminalProof"> | undefined;
}): Promise<TerminalProof | GameHubTerminalProof | null> {
  const indexedBet = findIndexedBetById(recentBets, terminalBet.betId);
  if (isTerminalIndexedBet(indexedBet)) {
    const indexedProof = await readTerminalProof({
      db,
      betId: terminalBet.betId,
      txHash: indexedBet?.lastTxHash
    });
    if (isCompleteTerminalProof(indexedProof)) return indexedProof;
  }

  try {
    const directProof = (await gameHub?.getTerminalProof(terminalBet.betId)) ?? null;
    return isCompleteTerminalProof(directProof) ? directProof : null;
  } catch {
    return null;
  }
}

export function useGameResolutionEffect({
  terminalBet,
  recentBets,
  db,
  gameHub,
  setIsPending,
  setShowResult,
  setResultProof,
  reset
}: {
  terminalBet: DomainBet | null;
  recentBets: readonly IndexedBetSummary[];
  db: Pick<SSOTDb, "gameHubEvents"> | undefined;
  gameHub: Pick<SSOTGameHubAPI, "getTerminalProof"> | undefined;
  setIsPending: React.Dispatch<React.SetStateAction<boolean>>;
  setShowResult: React.Dispatch<React.SetStateAction<boolean>>;
  setResultProof: React.Dispatch<React.SetStateAction<CasinoRoundResult | null>>;
  reset: () => void;
}) {
  const latestBetIdRef = React.useRef<bigint | undefined>();
  const displayedBetIdRef = React.useRef<bigint | undefined>();
  const proofTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>();

  React.useEffect(() => {
    if (!isTerminalDomainBet(terminalBet)) return;

    if (latestBetIdRef.current !== terminalBet.betId) {
      latestBetIdRef.current = terminalBet.betId;
      displayedBetIdRef.current = undefined;
      setIsPending(true);

      if (proofTimerRef.current) clearTimeout(proofTimerRef.current);
      reset();
    }

    let cancelled = false;
    const resolveProof = async () => {
      if (displayedBetIdRef.current === terminalBet.betId) return;

      const proof = await resolveCasinoTerminalProof({
        terminalBet,
        recentBets,
        db,
        gameHub
      });
      if (cancelled) return;
      if (!proof) {
        proofTimerRef.current = setTimeout(() => void resolveProof(), 1_500);
        return;
      }

      const result =
        proof.kind === "settled"
          ? buildCasinoRoundResult({ bet: terminalBet, settlement: proof.settlement })
          : buildCasinoRoundResult({ bet: terminalBet, refund: proof.refund });

      if (result.kind === "indexing") {
        proofTimerRef.current = setTimeout(() => void resolveProof(), 1_500);
        return;
      }

      // No auto-close: the modal stays open until the player acts (play again,
      // share, or close). It only ever opens for a fully settled round.
      displayedBetIdRef.current = terminalBet.betId;
      setIsPending(false);
      setResultProof(result);
      setShowResult(true);
    };

    void resolveProof();
    return () => {
      cancelled = true;
      if (proofTimerRef.current) clearTimeout(proofTimerRef.current);
    };
  }, [terminalBet, recentBets, db, gameHub, setIsPending, setShowResult, setResultProof, reset]);

  React.useEffect(
    () => () => {
      if (proofTimerRef.current) clearTimeout(proofTimerRef.current);
    },
    []
  );
}
