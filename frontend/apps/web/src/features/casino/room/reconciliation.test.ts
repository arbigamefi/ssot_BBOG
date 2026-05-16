import { describe, expect, it } from "vitest";

import {
  extractTerminalProofFromRows,
  findIndexedBetById,
  isTerminalIndexedBet,
  readTerminalProof,
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

  it("extracts terminal payout and refund proofs by bet id", () => {
    expect(
      extractTerminalProofFromRows(
        [
          {
            eventName: "BetFinalized",
            txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            argsJson: JSON.stringify({
              positionId: "123",
              payoutGross: "125",
              payoutNet: "120",
              feeOnPayout: "5",
              protocolFeeAccrual: "1"
            })
          }
        ] as any,
        123n
      )
    ).toEqual({
      kind: "settled",
      settlement: {
        txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        payoutGross: 125n,
        payoutNet: 120n,
        feeOnPayout: 5n,
        protocolFeeAccrual: 1n
      }
    });

    expect(
      extractTerminalProofFromRows(
        [
          {
            eventName: "BetRefunded",
            txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            argsJson: JSON.stringify({ positionId: "123", refundAmount: "100" })
          }
        ] as any,
        123n
      )
    ).toEqual({
      kind: "refunded",
      refund: {
        txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        refundAmount: 100n
      }
    });
  });

  it("reads terminal proof from the indexed GameHub event table", async () => {
    const db = {
      gameHubEvents: {
        where: () => ({
          equals: () => ({
            toArray: async () => [
              {
                eventName: "BetFinalized",
                txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                argsJson: JSON.stringify({
                  positionId: "123",
                  payoutGross: "125",
                  payoutNet: "120"
                })
              }
            ]
          })
        })
      }
    };

    await expect(
      readTerminalProof({
        db: db as any,
        betId: 123n,
        txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      })
    ).resolves.toEqual({
      kind: "settled",
      settlement: {
        txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        payoutGross: 125n,
        payoutNet: 120n,
        feeOnPayout: undefined,
        protocolFeeAccrual: undefined
      }
    });
  });
});
