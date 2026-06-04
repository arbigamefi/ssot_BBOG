import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "../../../og/render";
import {
  CASINO_GAME_COUNT,
  getCasinoGamePresentation
} from "../../../../features/casino/game-presentation";

export const alt = "ArbiGameFi casino game";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * Per-game OG card. Presentation data is shared with casino share surfaces so
 * social cards stay aligned with the same slug → visual/copy source.
 */
export default async function GameOpengraphImage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const card = getCasinoGamePresentation(slug) ?? {
    ogEyebrow: "Wallet-native casino",
    ogTitle: "Pick a game. One on-chain house.",
    ogSubtitle: "Dice, roulette, plinko, keno and more — paid out the instant you win.",
    ogStat: `${CASINO_GAME_COUNT} games`,
    ogTone: "cyan" as const,
    visualKind: "casino" as const
  };
  return renderOgCard({
    eyebrow: card.ogEyebrow,
    title: card.ogTitle,
    subtitle: card.ogSubtitle,
    stat: card.ogStat,
    tone: card.ogTone,
    visualKind: card.visualKind
  });
}
