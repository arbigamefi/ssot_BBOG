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
