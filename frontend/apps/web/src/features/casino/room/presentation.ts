export type ReleaseGamePresentationMeta = {
  slug?: string;
  houseEdgeBps?: number;
  maxPayout?: string | number | bigint;
};

export function formatHouseEdge(gameMeta: ReleaseGamePresentationMeta | undefined, slug: string) {
  const houseEdgeBps = gameMeta?.houseEdgeBps ?? (slug === "roulette" ? 270 : 100);
  return `${(houseEdgeBps / 100).toFixed(2)}%`;
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
  minLiquidityBps?: number;
};

/**
 * Free liquidity = totalAssets − reserved − minimum-liquidity reserve, clamped
 * to ≥ 0. Mirrors the bank's on-chain solvency math; this is the pool capacity
 * a single bet can draw against.
 */
export function computePoolFreeLiquidity(snapshot: BankLiquidityLike | null | undefined) {
  if (!snapshot) return undefined;
  const bps = BigInt(Math.max(0, Math.round(snapshot.minLiquidityBps ?? 0)));
  const minReserve = (snapshot.totalAssets * bps) / 10000n;
  const free = snapshot.totalAssets - snapshot.totalReserved - minReserve;
  return free > 0n ? free : 0n;
}

function formatPoolTokenAmount(raw: bigint, decimals: number, symbol: string) {
  const value = Number(raw) / Math.pow(10, decimals);
  const maximumFractionDigits = value >= 1000 || value === 0 ? 0 : 2;
  return `${value.toLocaleString("en-US", { maximumFractionDigits })} ${symbol}`;
}

/**
 * Live, asset-aware room limits derived from the selected pool's free liquidity:
 *  - maxPayout — the largest single-bet payout the pool can currently cover,
 *    matching Bank.holdBet solvency: NAV - reserved - minimum liquidity.
 *  - maxBet — the largest stake for the current odds = maxPayout / multiplier.
 * Returns "—" for values that can't be derived yet (snapshot not loaded, or no
 * selectable odds) so the header renders a stable placeholder.
 */
export function deriveGameRoomLimits({
  freeLiquidity,
  multiplier,
  assetDecimals,
  assetSymbol
}: {
  freeLiquidity: bigint | undefined;
  multiplier: number;
  assetDecimals: number;
  assetSymbol: string;
}): { maxBet: string; maxBetRaw?: bigint; maxPayout: string } {
  const dash = "—";
  if (freeLiquidity == null) return { maxBet: dash, maxPayout: dash };

  const maxPayout = formatPoolTokenAmount(freeLiquidity, assetDecimals, assetSymbol);
  if (!(multiplier > 0)) return { maxBet: dash, maxPayout };

  // maxBet = freeLiquidity / multiplier, bigint-safe via 1e6 scaling.
  const maxBetRaw = (freeLiquidity * 1_000_000n) / BigInt(Math.round(multiplier * 1_000_000));
  return {
    maxBet: formatPoolTokenAmount(maxBetRaw, assetDecimals, assetSymbol),
    maxBetRaw,
    maxPayout
  };
}
