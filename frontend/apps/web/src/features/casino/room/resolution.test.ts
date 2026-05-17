import { describe, expect, it, vi } from "vitest";
import type { DomainBet } from "@ssot/ssot";

import {
  appendGameHistoryEntry,
  buildCasinoRoundResult,
  isTerminalDomainBet,
  resolveCasinoTerminalProof
} from "./resolution";

const baseBet: DomainBet = {
  betId: 7n,
  chainId: 84532,
  gameId: "0x1111111111111111111111111111111111111111111111111111111111111111",
  asset: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
  bank: "0xbc9a8f34a416b6da463c634d63996c362e2c5f0a",
  player: "0xc8ec9920d573893e888db5d30b2b3b3824b1b684",
  stake: 10_000n,
  reserved: 20_000n,
  amountPerRoll: 10_000n,
  betCount: 1,
  vrfFeePaid: 100n,
  vrfFeeCharged: 90n,
  vrfCallbackGasLimit: 320_000,
  requestId: 88n,
  randomHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  state: "finalized" as const,
  placedAt: 1,
  resolvedAt: 2
};

describe("game room resolution helpers", () => {
  it("prepends resolved game history and caps the visible feed", () => {
    const history = [
      { val: 1, win: false },
      { val: 2, win: true },
      { val: 3, win: false },
      { val: 4, win: true },
      { val: 5, win: false }
    ];

    expect(appendGameHistoryEntry(history, { val: 99, win: true })).toEqual([
      { val: 99, win: true },
      { val: 1, win: false },
      { val: 2, win: true },
      { val: 3, win: false },
      { val: 4, win: true }
    ]);
  });

  it("marks only finalized and refunded chain bets as terminal", () => {
    expect(isTerminalDomainBet(baseBet)).toBe(true);
    expect(isTerminalDomainBet({ ...baseBet, state: "randomReady" })).toBe(false);
  });

  it("builds indexing first and enriches with settlement proof", () => {
    expect(buildCasinoRoundResult({ bet: baseBet })).toEqual({
      kind: "indexing",
      betId: 7n,
      requestId: 88n,
      randomHash: baseBet.randomHash,
      stake: 10_000n,
      resolvedAt: 2,
      settlement: undefined
    });

    expect(
      buildCasinoRoundResult({
        bet: baseBet,
        settlement: {
          txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          payoutGross: 20_000n,
          payoutNet: 19_600n
        }
      })
    ).toMatchObject({
      kind: "settled",
      settlement: { payoutNet: 19_600n }
    });
  });

  it("falls back to direct GameHub terminal proof when the indexer has not caught up", async () => {
    const getTerminalProof = vi.fn().mockResolvedValue({
      kind: "settled",
      settlement: {
        txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        payoutGross: 20_000n,
        payoutNet: 19_600n,
        feeOnPayout: 400n,
        protocolFeeAccrual: 200n
      }
    });

    const proof = await resolveCasinoTerminalProof({
      terminalBet: baseBet,
      recentBets: [],
      db: undefined,
      gameHub: { getTerminalProof }
    });

    expect(getTerminalProof).toHaveBeenCalledWith(7n);
    expect(proof).toMatchObject({
      kind: "settled",
      settlement: {
        payoutNet: 19_600n
      }
    });
  });

  it("keeps the result in reading state when direct GameHub proof read fails", async () => {
    const getTerminalProof = vi.fn().mockRejectedValue(new Error("range limit"));

    await expect(
      resolveCasinoTerminalProof({
        terminalBet: baseBet,
        recentBets: [],
        db: undefined,
        gameHub: { getTerminalProof }
      })
    ).resolves.toBeNull();
  });
});
