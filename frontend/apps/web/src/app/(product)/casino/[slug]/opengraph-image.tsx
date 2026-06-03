import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "../../../og/render";
import type { OgGlyphKind, OgTone } from "../../../og/glyphs";

export const alt = "ArbiGameFi casino game";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * Per-game OG card. Self-contained slug → presentation map so the image route
 * stays fast and free of release-loading. House-edge / payout highlights mirror
 * the Game Info tab copy.
 */
const GAME_CARDS: Record<
  string,
  {
    eyebrow: string;
    title: string;
    subtitle: string;
    stat: string;
    tone: OgTone;
    visualKind: OgGlyphKind;
  }
> = {
  dice: {
    eyebrow: "Provably fair · Dice",
    title: "Set the target. Roll on-chain.",
    subtitle: "Pick a direction, set your number, and verify the roll.",
    stat: "99×",
    tone: "cyan",
    visualKind: "dice"
  },
  "coin-toss": {
    eyebrow: "Provably fair · Coin toss",
    title: "Call the side. Flip on-chain.",
    subtitle: "A simple 50/50-style draw backed by Chainlink VRF.",
    stat: "1.98×",
    tone: "brand",
    visualKind: "coin-toss"
  },
  roulette: {
    eyebrow: "Provably fair · Roulette",
    title: "Spin the wheel. Verify the result.",
    subtitle: "Single-zero roulette with transparent on-chain settlement.",
    stat: "36×",
    tone: "brand",
    visualKind: "roulette"
  },
  keno: {
    eyebrow: "Provably fair · Keno",
    title: "Pick your numbers. Reveal the draw.",
    subtitle: "Choose from the grid and watch the draw land.",
    stat: "500×",
    tone: "cyan",
    visualKind: "keno"
  },
  plinko: {
    eyebrow: "Provably fair · Plinko",
    title: "Drop the ball. Reveal the path.",
    subtitle: "Choose risk, follow the bounce, and verify the bucket.",
    stat: "24×",
    tone: "green",
    visualKind: "plinko"
  },
  slots: {
    eyebrow: "Provably fair · Slots",
    title: "Spin three reels with VRF.",
    subtitle: "Classic reel play with public settlement proof.",
    stat: "64×",
    tone: "brand",
    visualKind: "slots"
  },
  baccarat: {
    eyebrow: "Provably fair · Baccarat",
    title: "Player. Banker. Tie.",
    subtitle: "Pick a side and verify the hand after settlement.",
    stat: "10×",
    tone: "green",
    visualKind: "baccarat"
  },
  "sic-bo": {
    eyebrow: "Provably fair · Sic Bo",
    title: "Three dice. One verified roll.",
    subtitle: "Small, big, totals, triples, and doubles settled by VRF.",
    stat: "216×",
    tone: "cyan",
    visualKind: "sic-bo"
  }
};

export default async function GameOpengraphImage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const card = GAME_CARDS[slug] ?? {
    eyebrow: "Wallet-native casino",
    title: "Game rooms. One on-chain house.",
    subtitle: "Wallet-native games with verifiable on-chain settlement.",
    stat: "Rooms",
    tone: "cyan" as const,
    visualKind: "casino" as const
  };
  return renderOgCard({
    eyebrow: card.eyebrow,
    title: card.title,
    subtitle: card.subtitle,
    badge: card.stat,
    stat: card.stat,
    tone: card.tone,
    visualKind: card.visualKind
  });
}
