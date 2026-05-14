export type GameMeta = {
  gameId: `0x${string}`;
  slug: string;
  label: string;
  module: `0x${string}`;
};

export type BetStatus = "won" | "lost" | "pending" | "settled" | "cancelled";

export function toGameMeta(raw: unknown): GameMeta {
  const source = raw as {
    gameId?: unknown;
    slug?: unknown;
    label?: unknown;
    module?: unknown;
  };

  return {
    gameId: source.gameId as `0x${string}`,
    slug: String(source.slug),
    label: String(source.label),
    module: source.module as `0x${string}`
  };
}

export function shortHex(value?: string) {
  if (!value) return "—";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function mapBetState(state?: string): BetStatus {
  if (!state) return "pending";
  const normalized = state.toLowerCase();
  if (normalized.includes("won")) return "won";
  if (normalized.includes("lost")) return "lost";
  if (normalized.includes("final") || normalized.includes("settled")) return "settled";
  if (normalized.includes("refund")) return "cancelled";
  return "pending";
}

// Precomputed gainFactor(played, k) table from the Keno module docs.
// Values are total-payout multipliers in basis points.
export const KENO_GAIN_TABLE: Record<number, number[]> = {
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

export function kenoMultiplier(played: number, matched: number): number {
  if (played < 1 || played > 10) return 0;
  const table = KENO_GAIN_TABLE[played];
  if (!table || matched < 0 || matched > played) return 0;
  return (table[matched] ?? 0) / 10000;
}

export function kenoWinChance(played: number): number {
  if (played <= 0) return 0;
  const totalCombinations = 847660528; // C(40, 10)
  const n = 40 - played;
  if (n < 10) return 99.9;

  let missCombinations = 1;
  for (let i = 0; i < 10; i++) {
    missCombinations = (missCombinations * (n - i)) / (i + 1);
  }

  const pZero = Math.round(missCombinations) / totalCombinations;
  return Math.min(99.9, (1 - pZero) * 100);
}

export const RED_NUMBERS: readonly number[] = [
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
] as const;

export const RED_NUMBER_SET = new Set<number>(RED_NUMBERS);

export const EUROPEAN_WHEEL_ORDER: readonly number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14,
  31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
] as const;
