import type { CoinSide, DiceDirection } from "./params";
import { rouletteCoveredNumbers } from "./params";
import { EUROPEAN_WHEEL_ORDER } from "./model";

export type GameSimulationInput = {
  slug: string;
  win: boolean;
  coinSide: CoinSide;
  diceDirection: DiceDirection;
  diceTarget: number;
  rouletteSpots: readonly string[];
  kenoSpots: readonly number[];
  rng?: () => number;
};

export type GameSimulationResult = {
  value: number;
  flipCoin?: boolean;
  kenoDrawn?: number[];
};

function pick<T>(items: readonly T[], rng: () => number): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(rng() * items.length)] ?? items[0];
}

function randomInt(maxExclusive: number, rng: () => number): number {
  return Math.floor(rng() * Math.max(1, maxExclusive));
}

function simulateDice(input: GameSimulationInput, rng: () => number): GameSimulationResult {
  const target = Math.max(1, Math.min(99, input.diceTarget));
  if (input.win && input.diceDirection === "under") return { value: randomInt(target, rng) };
  if (input.win && input.diceDirection === "over")
    return { value: target + randomInt(100 - target, rng) };
  if (!input.win && input.diceDirection === "under")
    return { value: target + randomInt(100 - target, rng) };
  return { value: randomInt(target, rng) };
}

function simulateRoulette(input: GameSimulationInput, rng: () => number): GameSimulationResult {
  const covered = rouletteCoveredNumbers(input.rouletteSpots);
  if (input.win && covered.length > 0) return { value: pick(covered, rng) ?? 0 };

  const losingNumbers = EUROPEAN_WHEEL_ORDER.filter((n) => !covered.includes(n));
  return { value: pick(losingNumbers, rng) ?? 0 };
}

function simulateKeno(input: GameSimulationInput, rng: () => number): GameSimulationResult {
  const drawn: number[] = [];
  const selected = [...input.kenoSpots];
  const remaining = Array.from({ length: 40 }, (_, i) => i + 1).filter(
    (n) => !selected.includes(n)
  );
  const hitsTarget = input.win ? Math.max(1, Math.floor(input.kenoSpots.length * 0.7)) : 0;

  for (let i = 0; i < hitsTarget && selected.length > 0; i++) {
    const idx = Math.floor(rng() * selected.length);
    drawn.push(selected.splice(idx, 1)[0]!);
  }

  while (drawn.length < 10 && remaining.length > 0) {
    const idx = Math.floor(rng() * remaining.length);
    drawn.push(remaining.splice(idx, 1)[0]!);
  }

  return {
    value: drawn.filter((n) => input.kenoSpots.includes(n)).length,
    kenoDrawn: drawn
  };
}

export function simulateGameResult(input: GameSimulationInput): GameSimulationResult {
  const rng = input.rng ?? Math.random;

  if (input.slug === "coin-toss") {
    return {
      value: input.win ? (input.coinSide === "HEADS" ? 1 : 0) : input.coinSide === "HEADS" ? 0 : 1,
      flipCoin: true
    };
  }

  if (input.slug === "dice") return simulateDice(input, rng);
  if (input.slug === "roulette") return simulateRoulette(input, rng);
  if (input.slug === "keno") return simulateKeno(input, rng);

  return { value: 0 };
}
