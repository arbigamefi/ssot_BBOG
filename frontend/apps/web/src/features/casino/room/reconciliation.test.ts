import { describe, expect, it } from "vitest";

import {
  findIndexedBetById,
  isTerminalIndexedBet,
  parseFinalizedPayoutWin,
  readFinalizedPayoutWin,
  type IndexedBetSummary
} from "./reconciliation";

const finalizedBet: IndexedBetSummary = {
  betId: "123",
  state: "finalized",
  lastTxHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
};

describe("game room reconciliation helpers", () => {
  it("finds a bet by id and identifies terminal states", () => {
    expect(findIndexedBetById([finalizedBet], 123n)).toBe(finalizedBet);
    expect(findIndexedBetById([finalizedBet], 456n)).toBeUndefined();
    expect(isTerminalIndexedBet(finalizedBet)).toBe(true);
    expect(isTerminalIndexedBet({ ...finalizedBet, state: "randomReady" })).toBe(false);
    expect(isTerminalIndexedBet({ ...finalizedBet, state: "refunded" })).toBe(true);
  });

  it("parses payout above stake as a win", () => {
    expect(parseFinalizedPayoutWin(JSON.stringify({ payout: "110", stake: "100" }))).toBe(true);
    expect(parseFinalizedPayoutWin(JSON.stringify({ totalPayout: "100", stake: "100" }))).toBe(
      false
    );
    expect(parseFinalizedPayoutWin("not-json")).toBe(false);
  });

  it("reads the finalized payout event from the indexed GameHub event table", async () => {
    const db = {
      gameHubEvents: {
        where: () => ({
          equals: () => ({
            filter: () => ({
              toArray: async () => [
                {
                  eventName: "BetFinalized",
                  argsJson: JSON.stringify({ payout: "125", stake: "100" })
                }
              ]
            })
          })
        })
      }
    };

    await expect(
      readFinalizedPayoutWin({
        db: db as any,
        txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      })
    ).resolves.toBe(true);
  });
});
