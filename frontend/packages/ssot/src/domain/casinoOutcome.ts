import {
  decodeCoinTossParams,
  decodeDiceParams,
  decodeKenoParams,
  decodePlinkoParams,
  decodeRouletteParams,
  type DiceDirection,
  type PlinkoRisk
} from "../encoding";
import type { DomainBet } from "./bet";
import { encodePacked, keccak256, stringToHex, type Hex } from "viem";

const RNG_DOMAIN = stringToHex("SSOT_RNG_V1");

const KENO_GAIN_TABLE: Record<number, number[]> = {
  1: [0, 23636],
  2: [0, 0, 32727],
  3: [0, 0, 3636, 36364],
  4: [0, 0, 909, 6818, 63636],
  5: [0, 0, 0, 1136, 11364, 136364],
  6: [0, 0, 0, 303, 1515, 15152, 181818],
  7: [0, 0, 0, 0, 404, 2020, 20202, 303030],
  8: [0, 0, 0, 0, 101, 505, 5051, 50505, 1010101],
  9: [0, 0, 0, 0, 0, 126, 1262, 12626, 252525, 5050505],
  10: [0, 0, 0, 0, 0, 0, 505, 5050, 50505, 1262626, 25252525]
};

const PLINKO_FACTOR_TABLE: Record<PlinkoRisk, readonly number[]> = {
  low: [15264, 13083, 10902, 9812, 8722, 9812, 10902, 13083, 15264],
  medium: [82714, 34464, 16542, 6892, 2067, 6892, 16542, 34464, 82714],
  high: [246153, 61538, 13186, 3076, 0, 3076, 13186, 61538, 246153]
};

const RED_NUMBERS: readonly number[] = [
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
] as const;

type RollTrace<T> = {
  value: T;
  won: boolean;
};

type OutcomeFinancials = {
  payoutGross: bigint;
  payoutNet: bigint;
  refundAmount: bigint;
  feeOnPayout: bigint;
  playerOwed: bigint;
  netResult: bigint;
};

export type CasinoOutcome =
  | (OutcomeFinancials & {
      kind: "dice";
      direction: DiceDirection;
      target: number;
      rolls: RollTrace<number>[];
    })
  | (OutcomeFinancials & {
      kind: "coin-toss";
      chosen: "HEADS" | "TAILS";
      rolls: RollTrace<"HEADS" | "TAILS">[];
    })
  | (OutcomeFinancials & {
      kind: "roulette";
      selectedNumbers: number[];
      rolls: RollTrace<number>[];
    })
  | (OutcomeFinancials & {
      kind: "keno";
      pickedNumbers: number[];
      draws: Array<{ numbers: number[]; hits: number; won: boolean }>;
    })
  | (OutcomeFinancials & {
      kind: "plinko";
      risk: PlinkoRisk;
      rolls: Array<{
        bucket: number;
        path: Array<"L" | "R">;
        factorBps: number;
        won: boolean;
      }>;
    });

export function deriveCasinoOutcome({
  bet,
  params,
  randomWords,
  gameSlug
}: {
  bet: DomainBet;
  params: Hex;
  randomWords: readonly bigint[];
  gameSlug: string;
}): CasinoOutcome | null {
  const seed = randomWords[0];
  if (seed == null || bet.betCount <= 0 || bet.amountPerRoll <= 0n) return null;

  if (gameSlug === "dice") {
    const decoded = decodeDiceParams(params);
    const direction = decoded.direction;
    const target = decoded.target;
    const denom = BigInt(direction === "over" ? 100 - target : target);
    const rolls: RollTrace<number>[] = [];
    let usedTurnover = 0n;
    let payoutGross = 0n;

    for (let i = 0; i < bet.betCount; i += 1) {
      usedTurnover += bet.amountPerRoll;
      const value = Number((rngRoll(bet.betId, i, seed) % 100n) + 1n);
      const won = direction === "over" ? value > target : value <= target;
      if (won) payoutGross += mulDiv(bet.amountPerRoll, 100n, denom);
      rolls.push({ value, won });
      if (shouldStop(bet.stopGain, bet.stopLoss, usedTurnover, payoutGross)) break;
    }

    return {
      kind: "dice",
      direction,
      target,
      rolls,
      ...financials(bet, payoutGross, bet.stake - usedTurnover)
    };
  }

  if (gameSlug === "coin-toss") {
    const { face } = decodeCoinTossParams(params);
    const chosen = face ? "TAILS" : "HEADS";
    const rolls: RollTrace<"HEADS" | "TAILS">[] = [];
    let usedTurnover = 0n;
    let payoutGross = 0n;

    for (let i = 0; i < bet.betCount; i += 1) {
      usedTurnover += bet.amountPerRoll;
      const value = rngRoll(bet.betId, i, seed) % 2n === 1n ? "TAILS" : "HEADS";
      const won = value === chosen;
      if (won) payoutGross += 2n * bet.amountPerRoll;
      rolls.push({ value, won });
      if (shouldStop(bet.stopGain, bet.stopLoss, usedTurnover, payoutGross)) break;
    }

    return {
      kind: "coin-toss",
      chosen,
      rolls,
      ...financials(bet, payoutGross, bet.stake - usedTurnover)
    };
  }

  if (gameSlug === "roulette") {
    const mask = rouletteMask(params);
    const selectedNumbers = maskToNumbers(mask, 37);
    const pickCount = BigInt(selectedNumbers.length);
    if (pickCount <= 0n) return null;
    const rolls: RollTrace<number>[] = [];
    let usedTurnover = 0n;
    let payoutGross = 0n;

    for (let i = 0; i < bet.betCount; i += 1) {
      usedTurnover += bet.amountPerRoll;
      const value = Number(rngRoll(bet.betId, i, seed) % 37n);
      const won = (mask & (1n << BigInt(value))) !== 0n;
      if (won) payoutGross += mulDiv(bet.amountPerRoll, 37n, pickCount);
      rolls.push({ value, won });
      if (shouldStop(bet.stopGain, bet.stopLoss, usedTurnover, payoutGross)) break;
    }

    return {
      kind: "roulette",
      selectedNumbers,
      rolls,
      ...financials(bet, payoutGross, bet.stake - usedTurnover)
    };
  }

  if (gameSlug === "keno") {
    const pickedMask = decodeKenoParams(params).mask;
    const pickedNumbers = maskToNumbers(pickedMask, 40).map((n) => n + 1);
    const played = pickedNumbers.length;
    if (played <= 0) return null;
    const draws: Array<{ numbers: number[]; hits: number; won: boolean }> = [];
    let usedTurnover = 0n;
    let payoutGross = 0n;

    for (let i = 0; i < bet.betCount; i += 1) {
      usedTurnover += bet.amountPerRoll;
      const drawMask = kenoDrawMask(bet.betId, i, seed);
      const numbers = maskToNumbers(drawMask, 40).map((n) => n + 1);
      const hits = popcount(pickedMask & drawMask);
      const factor = BigInt(KENO_GAIN_TABLE[played]?.[hits] ?? 0);
      if (factor > 0n) payoutGross += mulDiv(bet.amountPerRoll, factor, 10_000n);
      draws.push({ numbers, hits, won: factor > 0n });
      if (shouldStop(bet.stopGain, bet.stopLoss, usedTurnover, payoutGross)) break;
    }

    return {
      kind: "keno",
      pickedNumbers,
      draws,
      ...financials(bet, payoutGross, bet.stake - usedTurnover)
    };
  }

  if (gameSlug === "plinko") {
    const { risk } = decodePlinkoParams(params);
    const rolls: Array<{
      bucket: number;
      path: Array<"L" | "R">;
      factorBps: number;
      won: boolean;
    }> = [];
    let usedTurnover = 0n;
    let payoutGross = 0n;

    for (let i = 0; i < bet.betCount; i += 1) {
      usedTurnover += bet.amountPerRoll;
      const path: Array<"L" | "R"> = [];
      let bucket = 0;
      for (let row = 0; row < 8; row += 1) {
        const right = (rngRoll2(bet.betId, i, row, seed) & 1n) === 1n;
        path.push(right ? "R" : "L");
        if (right) bucket += 1;
      }

      const factor = PLINKO_FACTOR_TABLE[risk][bucket] ?? 0;
      if (factor > 0) payoutGross += mulDiv(bet.amountPerRoll, BigInt(factor), 10_000n);
      rolls.push({ bucket, path, factorBps: factor, won: factor > 10_000 });
      if (shouldStop(bet.stopGain, bet.stopLoss, usedTurnover, payoutGross)) break;
    }

    return {
      kind: "plinko",
      risk,
      rolls,
      ...financials(bet, payoutGross, bet.stake - usedTurnover)
    };
  }

  return null;
}

function rngRoll(betId: bigint, rollIndex: number, seed: bigint) {
  return BigInt(
    keccak256(
      encodePacked(
        ["bytes", "uint256", "uint256", "uint256"],
        [RNG_DOMAIN, betId, BigInt(rollIndex), seed]
      )
    )
  );
}

function rngRoll2(betId: bigint, rollIndex: number, drawIndex: number, seed: bigint) {
  return BigInt(
    keccak256(
      encodePacked(
        ["bytes", "uint256", "uint256", "uint256", "uint256"],
        [RNG_DOMAIN, betId, BigInt(rollIndex), BigInt(drawIndex), seed]
      )
    )
  );
}

function kenoDrawMask(betId: bigint, rollIndex: number, seed: bigint) {
  const available = Array.from({ length: 40 }, (_, i) => i);
  let result = 0n;
  let remaining = 40;

  for (let i = 0; i < 10; i += 1) {
    const randomIndex = Number(rngRoll2(betId, rollIndex, i, seed) % BigInt(remaining)) + i;
    const selectedIndex = available[randomIndex] ?? 0;
    result |= 1n << BigInt(selectedIndex);
    if (randomIndex !== i) available[randomIndex] = available[i] ?? i;
    remaining -= 1;
  }

  return result;
}

function shouldStop(
  stopGain: bigint | undefined,
  stopLoss: bigint | undefined,
  usedTurnover: bigint,
  payoutGross: bigint
) {
  if (
    stopGain &&
    stopGain > 0n &&
    payoutGross >= usedTurnover &&
    payoutGross - usedTurnover >= stopGain
  )
    return true;
  if (
    stopLoss &&
    stopLoss > 0n &&
    usedTurnover >= payoutGross &&
    usedTurnover - payoutGross >= stopLoss
  )
    return true;
  return false;
}

function financials(bet: DomainBet, payoutGross: bigint, refundAmount: bigint): OutcomeFinancials {
  const safeRefund = refundAmount > bet.stake ? bet.stake : refundAmount;
  const feeOnPayout =
    payoutGross > 0n ? mulDiv(payoutGross, BigInt(bet.effectiveHouseEdgeBps), 10_000n) : 0n;
  const payoutNet = payoutGross > feeOnPayout ? payoutGross - feeOnPayout : 0n;
  const playerOwed = payoutNet + safeRefund;
  return {
    payoutGross,
    payoutNet,
    refundAmount: safeRefund,
    feeOnPayout,
    playerOwed,
    netResult: playerOwed - bet.stake
  };
}

function rouletteMask(params: Hex) {
  const decoded = decodeRouletteParams(params);
  if (decoded.kind === "bitmask") return decoded.mask;
  if (decoded.kind === "straight") return 1n << BigInt(decoded.number);
  if (decoded.kind === "dozen") return rangeMask((decoded.dozen - 1) * 12 + 1, decoded.dozen * 12);
  if (decoded.kind === "column") return columnMask(decoded.column);
  if (decoded.kind === "red") return RED_NUMBERS.reduce((mask, n) => mask | (1n << BigInt(n)), 0n);
  if (decoded.kind === "black") return rangeMask(1, 36) & ~rouletteMaskFromNumbers(RED_NUMBERS);
  if (decoded.kind === "odd") return stepMask(1, 36, 2);
  if (decoded.kind === "even") return stepMask(2, 36, 2);
  if (decoded.kind === "low") return rangeMask(1, 18);
  if (decoded.kind === "high") return rangeMask(19, 36);
  if (decoded.kind === "split") return rouletteMaskFromNumbers([decoded.first, decoded.second]);
  if (decoded.kind === "street") return rangeMask(decoded.start, decoded.start + 2);
  if (decoded.kind === "corner")
    return rouletteMaskFromNumbers([
      decoded.start,
      decoded.start + 1,
      decoded.start + 3,
      decoded.start + 4
    ]);
  if (decoded.kind === "sixLine") return rangeMask(decoded.start, decoded.start + 5);
  return 0n;
}

function rouletteMaskFromNumbers(numbers: readonly number[]) {
  return numbers.reduce((mask, n) => mask | (1n << BigInt(n)), 0n);
}

function rangeMask(start: number, end: number) {
  return stepMask(start, end, 1);
}

function stepMask(start: number, end: number, step: number) {
  let mask = 0n;
  for (let n = start; n <= end; n += step) mask |= 1n << BigInt(n);
  return mask;
}

function columnMask(column: 1 | 2 | 3) {
  let mask = 0n;
  for (let n = column; n <= 36; n += 3) mask |= 1n << BigInt(n);
  return mask;
}

function maskToNumbers(mask: bigint, count: number) {
  const numbers: number[] = [];
  for (let i = 0; i < count; i += 1) {
    if ((mask & (1n << BigInt(i))) !== 0n) numbers.push(i);
  }
  return numbers;
}

function popcount(mask: bigint) {
  let n = mask;
  let count = 0;
  while (n > 0n) {
    if ((n & 1n) === 1n) count += 1;
    n >>= 1n;
  }
  return count;
}

function mulDiv(a: bigint, b: bigint, denominator: bigint) {
  return (a * b) / denominator;
}
