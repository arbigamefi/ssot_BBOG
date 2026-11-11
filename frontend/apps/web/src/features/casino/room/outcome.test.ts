import {
  encodeBaccaratParams,
  encodeCoinTossParams,
  encodeDiceParams,
  encodeKenoParams,
  encodePlinkoParams,
  encodeRouletteParams,
  encodeSicBoParams,
  encodeSlotsParams
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
  houseEdgeBps: 200,
  vrfFeePaid: 10n,
  vrfFeeCharged: 10n,
  vrfCallbackGasLimit: 320_000,
  requestId: 99n,
  randomHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
  state: "finalized",
  refundDeadline: 3601,
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
    expect(outcome.draws[0]?.numbers).toHaveLength(5);
    expect(outcome.draws[0]?.numbers.every((number) => number >= 1 && number <= 15)).toBe(true);
    expect(outcome.draws[0]?.hits).toBeGreaterThanOrEqual(0);
  });

  it("derives plinko bucket, path, and factor", () => {
    const outcome = deriveCasinoOutcome({
      bet: baseBet,
      gameSlug: "plinko",
      params: encodePlinkoParams("medium"),
      randomWords: [123n]
    });

    expect(outcome?.kind).toBe("plinko");
    if (outcome?.kind !== "plinko") return;
    expect(outcome.risk).toBe("medium");
    expect(outcome.rolls).toHaveLength(1);
    expect(outcome.rolls[0]?.path).toHaveLength(8);
    expect(outcome.rolls[0]?.bucket).toBeGreaterThanOrEqual(0);
    expect(outcome.rolls[0]?.bucket).toBeLessThanOrEqual(8);
    expect(outcome.rolls[0]?.factorBps).toBeGreaterThanOrEqual(0);
  });

  it("derives slots symbols and multiplier", () => {
    const outcome = deriveCasinoOutcome({
      bet: baseBet,
      gameSlug: "slots",
      params: encodeSlotsParams("classic"),
      randomWords: [123n]
    });

    expect(outcome?.kind).toBe("slots");
    if (outcome?.kind !== "slots") return;
    expect(outcome.profile).toBe("classic");
    expect(outcome.rolls).toHaveLength(1);
    expect(outcome.rolls[0]?.symbols).toHaveLength(3);
    expect(outcome.rolls[0]?.symbols.every((symbol) => symbol >= 0 && symbol <= 7)).toBe(true);
    expect([0, 2, 16, 64]).toContain(outcome.rolls[0]?.multiplier);
  });

  it("derives baccarat cards, totals, and winning side", () => {
    const outcome = deriveCasinoOutcome({
      bet: baseBet,
      gameSlug: "baccarat",
      params: encodeBaccaratParams("player"),
      randomWords: [123n]
    });

    expect(outcome?.kind).toBe("baccarat");
    if (outcome?.kind !== "baccarat") return;
    const [roll] = outcome.rolls;
    expect(outcome.side).toBe("player");
    expect(roll?.playerCards.length).toBeGreaterThanOrEqual(2);
    expect(roll?.bankerCards.length).toBeGreaterThanOrEqual(2);
    expect(roll?.playerTotal).toBeGreaterThanOrEqual(0);
    expect(roll?.playerTotal).toBeLessThanOrEqual(9);
    expect(roll?.bankerTotal).toBeGreaterThanOrEqual(0);
    expect(roll?.bankerTotal).toBeLessThanOrEqual(9);
    expect(["player", "banker", "tie"]).toContain(roll?.outcome);
  });

  it("keeps each baccarat card's rank, and its points follow from it", () => {
    const points = (rank: number) => (rank <= 8 ? rank + 1 : 0);
    const total = (ranks: number[]) => ranks.reduce((sum, rank) => sum + points(rank), 0) % 10;
    const ranks = new Set<number>();
    for (let seed = 1n; seed <= 40n; seed++) {
      const outcome = deriveCasinoOutcome({
        bet: { ...baseBet, betCount: 5, stake: 5_000_000n },
        gameSlug: "baccarat",
        params: encodeBaccaratParams("banker"),
        randomWords: [seed * 7_919n]
      });
      if (outcome?.kind !== "baccarat") throw new Error("not baccarat");
      for (const roll of outcome.rolls) {
        for (const rank of [...roll.playerRanks, ...roll.bankerRanks]) {
          expect(rank).toBeGreaterThanOrEqual(0);
          expect(rank).toBeLessThanOrEqual(12);
          ranks.add(rank);
        }
        expect(roll.playerCards).toEqual(roll.playerRanks.map(points));
        expect(roll.bankerCards).toEqual(roll.bankerRanks.map(points));
        expect(roll.playerTotal).toBe(total(roll.playerRanks));
        expect(roll.bankerTotal).toBe(total(roll.bankerRanks));
        // A natural on the first two cards stops the deal.
        const natural =
          total(roll.playerRanks.slice(0, 2)) >= 8 || total(roll.bankerRanks.slice(0, 2)) >= 8;
        if (natural) expect(roll.playerRanks.length + roll.bankerRanks.length).toBe(4);
      }
    }
    // Tens and pictures are told apart, though all count 0.
    expect([9, 10, 11, 12].every((rank) => ranks.has(rank))).toBe(true);
  });

  it("derives sic bo dice, total, and roll factor", () => {
    const outcome = deriveCasinoOutcome({
      bet: baseBet,
      gameSlug: "sic-bo",
      params: encodeSicBoParams({ kind: "singleFace", value: 6 }),
      randomWords: [123n]
    });

    expect(outcome?.kind).toBe("sic-bo");
    if (outcome?.kind !== "sic-bo") return;
    const [roll] = outcome.rolls;
    expect(outcome.betKind).toBe("singleFace");
    expect(outcome.betValue).toBe(6);
    expect(roll?.dice).toHaveLength(3);
    expect(roll?.dice.every((die) => die >= 1 && die <= 6)).toBe(true);
    expect(roll?.total).toBe((roll?.dice[0] ?? 0) + (roll?.dice[1] ?? 0) + (roll?.dice[2] ?? 0));
    expect(roll?.factorBps).toBe((roll?.faceCount ?? 0) * 20_000);
  });
});
