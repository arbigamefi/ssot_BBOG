import type { GameMeta } from "./model";

export type GameThemeColor = "purple" | "emerald" | "amber" | "fuchsia";

export type ReleaseGamePresentationMeta = {
  slug?: string;
  houseEdgeBps?: number;
  maxPayout?: string | number | bigint;
};

export function getGameThemeColor(slug: string): GameThemeColor {
  if (slug === "roulette") return "emerald";
  if (slug === "coin-toss") return "amber";
  if (slug === "keno") return "fuchsia";
  return "purple";
}

export function getGameDisplayName(game: GameMeta) {
  if (game.slug === "dice") return "Precision Dice";
  if (game.slug === "roulette") return "European Roulette";
  if (game.slug === "keno") return "Keno Draft";
  return game.label;
}

export function formatHouseEdge(gameMeta: ReleaseGamePresentationMeta | undefined, slug: string) {
  const houseEdgeBps = gameMeta?.houseEdgeBps ?? (slug === "roulette" ? 270 : 100);
  return `${(houseEdgeBps / 100).toFixed(2)}%`;
}

export function formatGameMaxPayout({
  gameMeta,
  slug,
  usdcDecimals
}: {
  gameMeta: ReleaseGamePresentationMeta | undefined;
  slug: string;
  usdcDecimals: number;
}) {
  const maxPayoutRaw = gameMeta?.maxPayout ? BigInt(String(gameMeta.maxPayout)) : undefined;
  if (maxPayoutRaw !== undefined) {
    return `${(Number(maxPayoutRaw) / Math.pow(10, usdcDecimals)).toLocaleString("en-US", {
      maximumFractionDigits: 0
    })} USDC`;
  }

  if (slug === "roulette") return "100,000 USDC";
  if (slug === "keno") return "500,000 USDC";
  return "25,000 USDC";
}
