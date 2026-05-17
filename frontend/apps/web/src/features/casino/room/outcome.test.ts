import {
  encodeCoinTossParams,
  encodeDiceParams,
  encodeKenoParams,
  encodeRouletteParams
} from "@ssot/ssot/encoding";
import type { DomainBet } from "@ssot/ssot";
import { describe, expect, it } from "vitest";

import { deriveCasinoOutcome } from "./outcome";

const baseBet: DomainBet = {
  betId: 11n,
  chainId: 84532,
  gameId: "0x00",
  asset: "0x0000000000000000000000000000000000000001",
  bank: "0x0000000000000000000000000000000000000002",
  player: "0x0000000000000000000000000000000000000003",
  stake: 1_000_000n,
  reserved: 2_000_000n,
  amountPerRoll: 1_000_000n,
  betCount: 1,
  stopGain: 0n,
  stopLoss: 0n,
  effectiveHouseEdgeBps: 200,
  vrfFeePaid: 10n,
  vrfFeeCharged: 10n,
  vrfCallbackGasLimit: 320_000,
  requestId: 99n,
  randomHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
  state: "finalized",
  placedAt: 1
};

describe("casino outcome derivation", () => {
  it("derives dice target and opened number from raw random words", () => {
    const outcome = deriveCasinoOutcome({
      bet: baseBet,
      gameSlug: "dice",
      params: encodeDiceParams({ direction: "under", target: 55 }),
      randomWords: [123n]
    });

    expect(outcome?.kind).toBe("dice");
    if (outcome?.kind !== "dice") return;
    expect(outcome.direction).toBe("under");
    expect(outcome.target).toBe(55);
    expect(outcome.rolls).toHaveLength(1);
    expect(outcome.rolls[0]?.value).toBeGreaterThanOrEqual(1);
    expect(outcome.rolls[0]?.value).toBeLessThanOrEqual(100);
    expect(outcome.playerOwed).toBe(outcome.payoutNet + outcome.refundAmount);
  });

  it("uses the contract coin toss bool mapping", () => {
    const outcome = deriveCasinoOutcome({
      bet: baseBet,
      gameSlug: "coin-toss",
      params: encodeCoinTossParams(false),
      randomWords: [123n]
    });

    expect(outcome?.kind).toBe("coin-toss");
    if (outcome?.kind !== "coin-toss") return;
    expect(outcome.chosen).toBe("HEADS");
    expect(["HEADS", "TAILS"]).toContain(outcome.rolls[0]?.value);
  });

  it("derives roulette winning number", () => {
    const outcome = deriveCasinoOutcome({
      bet: baseBet,
      gameSlug: "roulette",
      params: encodeRouletteParams({ kind: "straight", number: 17 }),
      randomWords: [123n]
    });

    expect(outcome?.kind).toBe("roulette");
    if (outcome?.kind !== "roulette") return;
    expect(outcome.selectedNumbers).toEqual([17]);
    expect(outcome.rolls[0]?.value).toBeGreaterThanOrEqual(0);
    expect(outcome.rolls[0]?.value).toBeLessThanOrEqual(36);
  });

  it("derives keno draw numbers and hits", () => {
    const outcome = deriveCasinoOutcome({
      bet: baseBet,
      gameSlug: "keno",
      params: encodeKenoParams(0b11n),
      randomWords: [123n]
    });

    expect(outcome?.kind).toBe("keno");
    if (outcome?.kind !== "keno") return;
    expect(outcome.pickedNumbers).toEqual([1, 2]);
    expect(outcome.draws[0]?.numbers).toHaveLength(10);
    expect(outcome.draws[0]?.hits).toBeGreaterThanOrEqual(0);
  });
});
