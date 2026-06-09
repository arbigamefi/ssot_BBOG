import { CASINO_MODULE_SLUGS, type CasinoModuleSlug } from "./modules";

/**
 * Number of games on the casino menu, derived from the module registry (the
 * single source of truth) so OG / marketing copy auto-updates when a game is
 * added and never serves a stale hardcoded count.
 */
export const CASINO_GAME_COUNT = CASINO_MODULE_SLUGS.length;

export type CasinoGameVisualKind = CasinoModuleSlug;
export type CasinoGameOgTone = "brand" | "cyan" | "green";

export type CasinoGamePresentation = {
  slug: CasinoModuleSlug;
  visualKind: CasinoGameVisualKind;
  ogEyebrow: string;
  ogTitle: string;
  ogSubtitle: string;
  ogStat: string;
  ogTone: CasinoGameOgTone;
};

export const CASINO_GAME_PRESENTATION: Record<CasinoModuleSlug, CasinoGamePresentation> = {
  dice: {
    slug: "dice",
    visualKind: "dice",
    ogEyebrow: "Provably fair · Dice",
    ogTitle: "Set the target. Roll on-chain.",
    ogSubtitle: "Pick a number and a direction — 1% house edge, every roll verifiable.",
    ogStat: "up to 99×",
    ogTone: "cyan"
  },
  "coin-toss": {
    slug: "coin-toss",
    visualKind: "coin-toss",
    ogEyebrow: "Provably fair · Coin toss",
    ogTitle: "Call the side. Flip on-chain.",
    ogSubtitle: "A true 50/50 decided by a single Chainlink VRF draw.",
    ogStat: "1.96×",
    ogTone: "brand"
  },
  roulette: {
    slug: "roulette",
    visualKind: "roulette",
    ogEyebrow: "Provably fair · Roulette",
    ogTitle: "Spin the single-zero wheel.",
    ogSubtitle: "European table — straight numbers, splits, and outside bets.",
    ogStat: "up to 36×",
    ogTone: "brand"
  },
  keno: {
    slug: "keno",
    visualKind: "keno",
    ogEyebrow: "Provably fair · Keno",
    ogTitle: "Pick your numbers. Watch them drop.",
    ogSubtitle: "Choose up to 5 from 15 — match more to win more.",
    ogStat: "up to 500×",
    ogTone: "cyan"
  },
  plinko: {
    slug: "plinko",
    visualKind: "plinko",
    ogEyebrow: "Provably fair · Plinko",
    ogTitle: "Drop the ball. Let the board pay.",
    ogSubtitle: "Nine rows, three risk tiers — the edge buckets pay the most.",
    ogStat: "up to 24×",
    ogTone: "green"
  },
  slots: {
    slug: "slots",
    visualKind: "slots",
    ogEyebrow: "Provably fair · Slots",
    ogTitle: "Spin three reels.",
    ogSubtitle: "Line up the top symbol across the payline for the max.",
    ogStat: "up to 64×",
    ogTone: "brand"
  },
  baccarat: {
    slug: "baccarat",
    visualKind: "baccarat",
    ogEyebrow: "Provably fair · Baccarat",
    ogTitle: "Player. Banker. Tie.",
    ogSubtitle: "Commission-free payouts on every settled hand.",
    ogStat: "up to 10×",
    ogTone: "green"
  },
  "sic-bo": {
    slug: "sic-bo",
    visualKind: "sic-bo",
    ogEyebrow: "Provably fair · Sic Bo",
    ogTitle: "Three dice. One verified roll.",
    ogSubtitle: "Bet small, big, totals, doubles, or triples.",
    ogStat: "up to 216×",
    ogTone: "cyan"
  }
};

export function getCasinoGamePresentation(slug?: string | null) {
  if (!slug || !isCasinoGamePresentationSlug(slug)) return undefined;
  return CASINO_GAME_PRESENTATION[slug];
}

export function isCasinoGamePresentationSlug(slug: string): slug is CasinoModuleSlug {
  return Object.prototype.hasOwnProperty.call(CASINO_GAME_PRESENTATION, slug);
}
