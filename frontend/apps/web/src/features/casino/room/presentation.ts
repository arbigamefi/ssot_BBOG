import { MAX_TREE_CAPITAL } from "@ssot/ssot/sdk";
import type { ReserveRatio } from "./params";

/** Minimal bank-snapshot shape needed to derive spendable liquidity. */
export type BankLiquidityLike = {
  G: bigint;
  R: bigint;
  riskReserveBps?: number;
};

function normalizeRiskReserveBps(snapshot: BankLiquidityLike) {
  return BigInt(Math.max(0, Math.round(snapshot.riskReserveBps ?? 0)));
}

function reserveForStake(stake: bigint, ratio: ReserveRatio) {
  return (stake * ratio.numerator) / ratio.denominator;
}

/**
 * Free liquidity = G − R − risk reserve, clamped
 * to ≥ 0. Mirrors the bank's on-chain solvency math; this is the pool capacity
 * a single bet can draw against.
 */
export function computePoolFreeLiquidity(snapshot: BankLiquidityLike | null | undefined) {
  if (!snapshot) return undefined;
  const bps = normalizeRiskReserveBps(snapshot);
  const riskReserve = (snapshot.G * bps) / 10000n;
  const free = snapshot.G - snapshot.R - riskReserve;
  return free > 0n ? free : 0n;
}

export function canPoolHoldBet({
  snapshot,
  stake,
  requiredReserve
}: {
  snapshot: BankLiquidityLike;
  stake: bigint;
  requiredReserve: bigint;
}) {
  const bps = normalizeRiskReserveBps(snapshot);
  const navAfterStake = snapshot.G + stake;
  const reservedAfterStake = snapshot.R + requiredReserve;
  if (
    stake < 0n ||
    navAfterStake > MAX_TREE_CAPITAL ||
    requiredReserve < stake ||
    navAfterStake < reservedAfterStake
  )
    return false;
  const riskReserveAfterStake = (navAfterStake * bps) / 10000n;
  return navAfterStake - reservedAfterStake >= riskReserveAfterStake;
}

/** Exact largest total stake satisfying the Bank and module integer floors. */
export function computePoolMaxStakeForReserve({
  snapshot,
  reserveRatio
}: {
  snapshot: BankLiquidityLike | null | undefined;
  reserveRatio: ReserveRatio | undefined;
}) {
  if (
    !snapshot ||
    !reserveRatio ||
    reserveRatio.denominator <= 0n ||
    reserveRatio.numerator < reserveRatio.denominator
  )
    return undefined;
  if (snapshot.G >= MAX_TREE_CAPITAL) return 0n;
  let low = 0n;
  let high = MAX_TREE_CAPITAL - snapshot.G;
  // For admitted ratios >= 1, increasing stake never improves the solvency
  // difference. Search base units exactly, bounded by the 108-bit capital limit.
  while (low < high) {
    const mid = (low + high + 1n) / 2n;
    if (
      canPoolHoldBet({ snapshot, stake: mid, requiredReserve: reserveForStake(mid, reserveRatio) })
    )
      low = mid;
    else high = mid - 1n;
  }
  return low;
}

function formatPoolTokenAmount(raw: bigint, decimals: number, symbol: string) {
  const unit = 10n ** BigInt(decimals);
  const fraction = (raw % unit).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${(raw / unit).toLocaleString("en-US")}${fraction ? `.${fraction}` : ""} ${symbol}`;
}

/** Display and enforce one per-round cap; show its executable batch total separately. */
export function deriveGameRoomLimits({
  poolSnapshot,
  reserveRatio,
  betCount,
  assetDecimals,
  assetSymbol
}: {
  poolSnapshot: BankLiquidityLike | null | undefined;
  reserveRatio: ReserveRatio | undefined;
  betCount: number;
  assetDecimals: number;
  assetSymbol: string;
}): {
  maxBet: string;
  maxBetRaw?: bigint;
  maxTotal: string;
  maxBetState: "value" | "pending-selection" | "pending-liquidity" | "no-capacity";
  maxPayout: string;
  maxPayoutState: "value" | "pending-liquidity" | "no-capacity";
} {
  const empty = { maxBet: "—", maxTotal: "—", maxPayout: "—" };
  if (!poolSnapshot)
    return { ...empty, maxBetState: "pending-liquidity", maxPayoutState: "pending-liquidity" };
  if (!reserveRatio || !Number.isInteger(betCount) || betCount < 1)
    return { ...empty, maxBetState: "pending-selection", maxPayoutState: "pending-liquidity" };
  const maxTotal = computePoolMaxStakeForReserve({ snapshot: poolSnapshot, reserveRatio });
  if (maxTotal == null)
    return { ...empty, maxBetState: "pending-selection", maxPayoutState: "pending-liquidity" };
  const maxBetRaw = maxTotal / BigInt(betCount);
  const executableTotal = maxBetRaw * BigInt(betCount);
  const state = maxBetRaw > 0n ? "value" : "no-capacity";
  return {
    maxBet: formatPoolTokenAmount(maxBetRaw, assetDecimals, assetSymbol),
    maxBetRaw,
    maxTotal: formatPoolTokenAmount(executableTotal, assetDecimals, assetSymbol),
    maxBetState: state,
    maxPayout: formatPoolTokenAmount(
      reserveForStake(executableTotal, reserveRatio),
      assetDecimals,
      assetSymbol
    ),
    maxPayoutState: state
  };
}
