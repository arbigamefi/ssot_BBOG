import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "../../../og/render";

export const alt = "ArbiGameFi casino game";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * Per-game OG card. Self-contained slug → presentation map so the image route
 * stays fast and free of release-loading. House-edge / payout highlights mirror
 * the Game Info tab copy.
 */
const GAME_CARDS: Record<string, { name: string; subtitle: string; badge: string }> = {
  dice: {
    name: "Dice",
    subtitle: "Pick a target, pick a direction. 1% house edge.",
    badge: "up to 99×"
  },
  "coin-toss": {
    name: "Coin Toss",
    subtitle: "True 50/50, decided by one Chainlink VRF draw.",
    badge: "1.98×"
  },
  roulette: {
    name: "Roulette",
    subtitle: "European single-zero table. Every spin signed on-chain.",
    badge: "up to 36×"
  },
  keno: {
    name: "Keno",
    subtitle: "Pick up to 5 from 15. Match more, win more.",
    badge: "up to 500×"
  },
  plinko: {
    name: "Plinko",
    subtitle: "Drop through a 9-row board. Risk shapes the curve.",
    badge: "up to 24×"
  },
  slots: {
    name: "Slots",
    subtitle: "Three-reel classic. Triple the top symbol for the max.",
    badge: "up to 64×"
  },
  baccarat: {
    name: "Baccarat",
    subtitle: "Player, Banker, or Tie — commission-free payouts.",
    badge: "up to 10×"
  },
  "sic-bo": {
    name: "Sic Bo",
    subtitle: "Three dice. Small/Big, triples, doubles, and totals.",
    badge: "up to 216×"
  }
};

export default async function GameOpengraphImage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const card = GAME_CARDS[slug] ?? {
    name: "Casino",
    subtitle: "Wallet-native games with verifiable on-chain settlement.",
    badge: "8 games"
  };
  return renderOgCard({
    eyebrow: "Play on-chain",
    title: card.name,
    subtitle: card.subtitle,
    badge: card.badge,
    metrics: [
      { label: "Randomness", value: "VRF" },
      { label: "Settlement", value: "On-chain" },
      { label: "Game", value: card.name }
    ]
  });
}
