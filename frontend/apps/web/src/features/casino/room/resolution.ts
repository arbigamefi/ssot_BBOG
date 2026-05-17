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
      kind: refund ? "refunded" : "indexing",
      betId: bet.betId,
      requestId: bet.requestId,
      randomHash: bet.randomHash,
      stake: bet.stake,
      resolvedAt: bet.resolvedAt,
      refund
    };
  }

  return {
    kind: settlement ? "settled" : "indexing",
    betId: bet.betId,
    requestId: bet.requestId,
    randomHash: bet.randomHash,
    stake: bet.stake,
    resolvedAt: bet.resolvedAt,
    settlement
  };
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
    if (indexedProof) return indexedProof;
  }

  try {
    return (await gameHub?.getTerminalProof(terminalBet.betId)) ?? null;
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
  const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>();

  React.useEffect(() => {
    if (!isTerminalDomainBet(terminalBet)) return;

    if (latestBetIdRef.current !== terminalBet.betId) {
      latestBetIdRef.current = terminalBet.betId;
      setIsPending(false);
      setShowResult(true);
      setResultProof(buildCasinoRoundResult({ bet: terminalBet }));

      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        setShowResult(false);
        setResultProof(null);
      }, 8_000);
      reset();
    }

    let cancelled = false;
    const resolveProof = async () => {
      const proof = await resolveCasinoTerminalProof({
        terminalBet,
        recentBets,
        db,
        gameHub
      });
      if (cancelled || !proof) return;
      setResultProof(
        proof.kind === "settled"
          ? buildCasinoRoundResult({ bet: terminalBet, settlement: proof.settlement })
          : buildCasinoRoundResult({ bet: terminalBet, refund: proof.refund })
      );
    };

    void resolveProof();
    return () => {
      cancelled = true;
    };
  }, [terminalBet, recentBets, db, gameHub, setIsPending, setShowResult, setResultProof, reset]);

  React.useEffect(
    () => () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    []
  );
}
