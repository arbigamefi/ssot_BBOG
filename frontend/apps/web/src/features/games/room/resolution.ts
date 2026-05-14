import * as React from "react";
import type { SSOTDb } from "@ssot/ssot/indexer";

import type { CoinSide, DiceDirection } from "./params";
import {
  findIndexedBetById,
  isTerminalIndexedBet,
  readFinalizedPayoutWin,
  type IndexedBetSummary
} from "./reconciliation";
import { simulateGameResult } from "./simulation";

export type GameHistoryEntry = {
  val: number;
  win: boolean;
};

export function appendGameHistoryEntry(
  history: readonly GameHistoryEntry[],
  entry: GameHistoryEntry,
  limit = 5
) {
  return [entry, ...history].slice(0, limit);
}

export function useGameResolutionEffect({
  status,
  betId,
  recentBets,
  db,
  gameSlug,
  coinSide,
  diceDirection,
  diceTarget,
  rouletteSpots,
  kenoSpots,
  setIsPending,
  setShowResult,
  setFlipCount,
  setResultNum,
  setKenoResultDrawn,
  setGameHistory,
  reset
}: {
  status: string;
  betId: bigint | undefined;
  recentBets: readonly IndexedBetSummary[];
  db: Pick<SSOTDb, "hubEvents"> | undefined;
  gameSlug: string;
  coinSide: CoinSide;
  diceDirection: DiceDirection;
  diceTarget: number;
  rouletteSpots: readonly string[];
  kenoSpots: readonly number[];
  setIsPending: React.Dispatch<React.SetStateAction<boolean>>;
  setShowResult: React.Dispatch<React.SetStateAction<boolean>>;
  setFlipCount: React.Dispatch<React.SetStateAction<number>>;
  setResultNum: React.Dispatch<React.SetStateAction<number | null>>;
  setKenoResultDrawn: React.Dispatch<React.SetStateAction<number[]>>;
  setGameHistory: React.Dispatch<React.SetStateAction<GameHistoryEntry[]>>;
  reset: () => void;
}) {
  const latestBetIdRef = React.useRef<bigint | undefined>();

  React.useEffect(() => {
    if (status !== "reconciled" || betId === undefined) return;

    if (latestBetIdRef.current !== betId) {
      latestBetIdRef.current = betId;
      setIsPending(true);
    }

    const indexedBet = findIndexedBetById(recentBets, betId);
    if (!isTerminalIndexedBet(indexedBet)) return;

    setIsPending(false);
    setShowResult(true);

    const resolvePayout = async () => {
      const win = await readFinalizedPayoutWin({ db, txHash: indexedBet?.lastTxHash });
      const simulated = simulateGameResult({
        slug: gameSlug,
        win,
        coinSide,
        diceDirection,
        diceTarget,
        rouletteSpots,
        kenoSpots
      });

      if (simulated.flipCoin) setFlipCount((current) => current + 1);
      if (gameSlug === "dice" || gameSlug === "roulette") {
        setResultNum(simulated.value);
      }
      if (simulated.kenoDrawn) {
        setKenoResultDrawn(simulated.kenoDrawn);
      }

      setGameHistory((history) => appendGameHistoryEntry(history, { val: simulated.value, win }));
      setTimeout(() => setShowResult(false), 8000);
      reset();
    };

    void resolvePayout();
  }, [
    status,
    betId,
    recentBets,
    db,
    gameSlug,
    coinSide,
    diceDirection,
    diceTarget,
    rouletteSpots,
    kenoSpots,
    setIsPending,
    setShowResult,
    setFlipCount,
    setResultNum,
    setKenoResultDrawn,
    setGameHistory,
    reset
  ]);
}
