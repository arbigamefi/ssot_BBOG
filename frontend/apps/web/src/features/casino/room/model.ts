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

// Keno gain factors live in the SSOT package (`KENO_GAIN_TABLE` /
// `kenoMultiplier`), where they mirror `KenoModule.sol` and are pinned by test.
// Import them from `@ssot/ssot/domain` directly — do not re-add a local copy.

export function kenoWinChance(played: number): number {
  if (played <= 0) return 0;
  const totalCombinations = 3003; // C(15, 5)
  const n = 15 - played;
  if (n < 5) return 99.9;

  let missCombinations = 1;
  for (let i = 0; i < 5; i++) {
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
