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

export type CasinoRoundResult = {
  kind: "settled" | "refunded" | "indexing";
  betId: bigint;
  requestId: bigint;
  randomHash: `0x${string}`;
  stake: bigint;
  resolvedAt?: number;
  settlement?: SettlementProof;
  refund?: RefundProof;
};

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
    return {
      kind: refund?.refundAmount == null ? "indexing" : "refunded",
      betId: bet.betId,
      requestId: bet.requestId,
      randomHash: bet.randomHash,
      stake: bet.stake,
      resolvedAt: bet.resolvedAt,
      refund
    };
  }

  return {
    kind: settlement?.payoutNet == null ? "indexing" : "settled",
    betId: bet.betId,
    requestId: bet.requestId,
    randomHash: bet.randomHash,
    stake: bet.stake,
    resolvedAt: bet.resolvedAt,
    settlement
  };
}

export function isCompleteTerminalProof(
  proof: TerminalProof | GameHubTerminalProof | null | undefined
) {
  if (!proof) return false;
  if (proof.kind === "settled") return proof.settlement.payoutNet != null;
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
  const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>();
  const proofTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>();

  React.useEffect(() => {
    if (!isTerminalDomainBet(terminalBet)) return;

    if (latestBetIdRef.current !== terminalBet.betId) {
      latestBetIdRef.current = terminalBet.betId;
      displayedBetIdRef.current = undefined;
      setIsPending(true);
      setShowResult(false);
      setResultProof(null);

      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
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

      displayedBetIdRef.current = terminalBet.betId;
      setIsPending(false);
      setResultProof(result);
      setShowResult(true);

      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        setShowResult(false);
        setResultProof(null);
      }, 8_000);
    };

    void resolveProof();
    return () => {
      cancelled = true;
      if (proofTimerRef.current) clearTimeout(proofTimerRef.current);
    };
  }, [terminalBet, recentBets, db, gameHub, setIsPending, setShowResult, setResultProof, reset]);

  React.useEffect(
    () => () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (proofTimerRef.current) clearTimeout(proofTimerRef.current);
    },
    []
  );
}
