// Kept apart from casinoOutcome.ts, which decodes with viem, so pages that only show
// payouts can import the table without the ABI decoders.

/**
 * Keno gain factors in 1/10000 units, indexed as `[played][matchCount]`.
 *
 * Single source of truth for Keno payouts on the frontend: mirrors
 * `KenoModule.sol` `_gain(played, matchCount)` exactly (pool N=15, draw M=5).
 * These are gross factors — the GameHub applies house edge separately as
 * fee-on-payout (ADR-0007), so the gross expectation is ~1.0. Total payout =
 * `amountPerRoll * factor / 10000`.
 *
 * Do not hand-tune: if the contract table changes, regenerate from
 * `src/modules/keno/KenoModule.sol`. Pinned by `kenoGains.test.ts`.
 */
export const KENO_GAIN_TABLE: Record<number, readonly number[]> = {
  1: [7500, 15000],
  2: [7777, 7000, 35000],
  3: [9479, 5055, 11375, 113750],
  4: [13000, 4550, 6066, 27300, 546000],
  5: [19861, 4766, 4170, 11122, 100100, 5005000]
};

/** Keno gross gain factor in 1/10000 units; 0 for an invalid `(played, matchCount)`. */
export function kenoGainFactor(played: number, matchCount: number): number {
  if (played < 1 || played > 5) return 0;
  const row = KENO_GAIN_TABLE[played];
  if (!row || matchCount < 0 || matchCount > played) return 0;
  return row[matchCount] ?? 0;
}

/** Keno total-payout multiplier (gross gain factor / 10000). */
export function kenoMultiplier(played: number, matchCount: number): number {
  return kenoGainFactor(played, matchCount) / 10000;
}
