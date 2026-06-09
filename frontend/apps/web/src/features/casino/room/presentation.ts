export type ReleaseGamePresentationMeta = {
  slug?: string;
  houseEdgeBps?: number;
  maxPayout?: string | number | bigint;
};

export type ReleasePresentationMeta = {
  defaultHouseEdgeBps?: number;
};

function normalizeHouseEdgeBps(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(10_000, Math.round(value)));
}

export function resolveHouseEdgeBps(
  gameMeta: ReleaseGamePresentationMeta | undefined,
  slug: string,
  release?: ReleasePresentationMeta
) {
  return (
    normalizeHouseEdgeBps(gameMeta?.houseEdgeBps) ??
    normalizeHouseEdgeBps(release?.defaultHouseEdgeBps) ??
    (slug === "roulette" ? 270 : 100)
  );
}

export function formatHouseEdge(
  gameMeta: ReleaseGamePresentationMeta | undefined,
  slug: string,
  release?: ReleasePresentationMeta
) {
  return `${(resolveHouseEdgeBps(gameMeta, slug, release) / 100).toFixed(2)}%`;
}

export function formatGameMaxPayout({
  gameMeta,
  slug,
  assetDecimals,
  assetSymbol
}: {
  gameMeta: ReleaseGamePresentationMeta | undefined;
  slug: string;
  assetDecimals: number;
  assetSymbol: string;
}) {
  const maxPayoutRaw = gameMeta?.maxPayout ? BigInt(String(gameMeta.maxPayout)) : undefined;
  if (maxPayoutRaw !== undefined) {
    return `${(Number(maxPayoutRaw) / Math.pow(10, assetDecimals)).toLocaleString("en-US", {
      maximumFractionDigits: 0
    })} ${assetSymbol}`;
  }

  if (slug === "roulette") return `100,000 ${assetSymbol}`;
  if (slug === "keno") return `500,000 ${assetSymbol}`;
  return `25,000 ${assetSymbol}`;
}

/** Minimal bank-snapshot shape needed to derive spendable liquidity. */
export type BankLiquidityLike = {
  totalAssets: bigint;
  totalReserved: bigint;
  riskReserveBps?: number;
  minLiquidityBps?: number;
};

const LIMIT_SCALE = 1_000_000n;

function normalizeRiskReserveBps(snapshot: BankLiquidityLike) {
  return BigInt(Math.max(0, Math.round(snapshot.riskReserveBps ?? snapshot.minLiquidityBps ?? 0)));
}

function scaledReserveMultiplier(reserveMultiplier: number) {
  if (!Number.isFinite(reserveMultiplier) || reserveMultiplier <= 0) return 0n;
  return BigInt(Math.max(0, Math.round(reserveMultiplier * Number(LIMIT_SCALE))));
}

function multiplyByScaledMultiplier(raw: bigint, scaledMultiplier: bigint) {
  return (raw * scaledMultiplier) / LIMIT_SCALE;
}

function reserveForStake(stake: bigint, scaledMultiplier: bigint) {
  return multiplyByScaledMultiplier(stake, scaledMultiplier);
}

/**
 * Free liquidity = totalAssets − reserved − minimum-liquidity reserve, clamped
 * to ≥ 0. Mirrors the bank's on-chain solvency math; this is the pool capacity
 * a single bet can draw against.
 */
export function computePoolFreeLiquidity(snapshot: BankLiquidityLike | null | undefined) {
  if (!snapshot) return undefined;
  const bps = normalizeRiskReserveBps(snapshot);
  const riskReserve = (snapshot.totalAssets * bps) / 10000n;
  const free = snapshot.totalAssets - snapshot.totalReserved - riskReserve;
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
  const navAfterStake = snapshot.totalAssets + stake;
  const reservedAfterStake = snapshot.totalReserved + requiredReserve;
  if (navAfterStake < reservedAfterStake) return false;
  const riskReserveAfterStake = (navAfterStake * bps) / 10000n;
  return navAfterStake - reservedAfterStake >= riskReserveAfterStake;
}

/**
 * Maximum stake that can pass Bank.holdBet for a gross reserve multiplier.
 *
 * Bank first transfers the player's stake into the pool, then checks:
 *   NAV + stake - (reserved + stake * multiplier) >= riskReserve(NAV + stake)
 *
 * So the stake itself increases solvency; using freeLiquidity / multiplier is
 * too conservative and, worse, can drift away from the actual chain condition.
 */
export function computePoolMaxStakeForReserve({
  snapshot,
  reserveMultiplier
}: {
  snapshot: BankLiquidityLike | null | undefined;
  reserveMultiplier: number;
}) {
  if (!snapshot || !(reserveMultiplier > 0)) return undefined;
  const freeLiquidity = computePoolFreeLiquidity(snapshot);
  if (freeLiquidity == null || freeLiquidity === 0n) return freeLiquidity;

  const multiplierScaled = scaledReserveMultiplier(reserveMultiplier);
  const bps = normalizeRiskReserveBps(snapshot);
  const riskScaled = (bps * LIMIT_SCALE) / 10000n;
  const denominator = multiplierScaled - LIMIT_SCALE + riskScaled;
  if (denominator <= 0n) return undefined;

  let candidate = (freeLiquidity * LIMIT_SCALE) / denominator;
  for (let i = 0; i < 1024; i += 1) {
    if (
      canPoolHoldBet({
        snapshot,
        stake: candidate,
        requiredReserve: reserveForStake(candidate, multiplierScaled)
      })
    ) {
      break;
    }
    candidate = candidate > 0n ? candidate - 1n : 0n;
  }
  // Solidity floors both reserve and risk-reserve math. The closed-form
  // division can be one or a few base units conservative, so walk upward to
  // the exact last stake the Bank can hold.
  for (let i = 0; i < 1024; i += 1) {
    const next = candidate + 1n;
    if (
      !canPoolHoldBet({
        snapshot,
        stake: next,
        requiredReserve: reserveForStake(next, multiplierScaled)
      })
    ) {
      break;
    }
    candidate = next;
  }
  return candidate;
}

function formatPoolTokenAmount(raw: bigint, decimals: number, symbol: string) {
  const value = Number(raw) / Math.pow(10, decimals);
  const maximumFractionDigits = value >= 1000 || value === 0 ? 0 : 2;
  return `${value.toLocaleString("en-US", { maximumFractionDigits })} ${symbol}`;
}

/**
 * Live, asset-aware room limits derived from the selected pool's free liquidity:
 *  - maxPayout — the largest gross payout reserve the pool can currently cover,
 *    matching the conservative SDK preflight: NAV - reserved - minimum liquidity.
 *  - maxBet — the largest stake for the game module's gross reserve multiplier.
 *    This intentionally differs from the player-facing net multiplier because
 *    GameHub applies house edge after the Bank has already reserved gross payout.
 * Returns "—" for values that can't be derived yet (snapshot not loaded, or no
 * selectable odds) so the header renders a stable placeholder.
 */
export function deriveGameRoomLimits({
  freeLiquidity,
  poolSnapshot,
  reserveMultiplier,
  assetDecimals,
  assetSymbol
}: {
  freeLiquidity: bigint | undefined;
  poolSnapshot?: BankLiquidityLike | null;
  reserveMultiplier: number;
  assetDecimals: number;
  assetSymbol: string;
}): {
  maxBet: string;
  maxBetRaw?: bigint;
  maxBetState: "value" | "pending-selection" | "pending-liquidity" | "no-capacity";
  maxPayout: string;
  maxPayoutState: "value" | "pending-liquidity" | "no-capacity";
} {
  const dash = "—";
  if (freeLiquidity == null)
    return {
      maxBet: dash,
      maxBetState: "pending-liquidity",
      maxPayout: dash,
      maxPayoutState: "pending-liquidity"
    };

  const maxPayout = formatPoolTokenAmount(freeLiquidity, assetDecimals, assetSymbol);
  const maxPayoutState = freeLiquidity === 0n ? "no-capacity" : "value";
  if (!(reserveMultiplier > 0))
    return { maxBet: dash, maxBetState: "pending-selection", maxPayout, maxPayoutState };
  if (freeLiquidity === 0n)
    return { maxBet: maxPayout, maxBetState: "no-capacity", maxPayout, maxPayoutState };

  const maxBetRaw =
    computePoolMaxStakeForReserve({ snapshot: poolSnapshot, reserveMultiplier }) ??
    (freeLiquidity * LIMIT_SCALE) / scaledReserveMultiplier(reserveMultiplier);
  const reserveMultiplierScaled = scaledReserveMultiplier(reserveMultiplier);
  const selectedMaxPayoutRaw =
    reserveMultiplierScaled > 0n
      ? multiplyByScaledMultiplier(maxBetRaw, reserveMultiplierScaled)
      : freeLiquidity;
  return {
    maxBet: formatPoolTokenAmount(maxBetRaw, assetDecimals, assetSymbol),
    maxBetRaw,
    maxBetState: "value",
    maxPayout: formatPoolTokenAmount(selectedMaxPayoutRaw, assetDecimals, assetSymbol),
    maxPayoutState
  };
}
