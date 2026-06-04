import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "../../og/render";
import { CASINO_GAME_COUNT } from "../../../features/casino/game-presentation";

export const alt = "ArbiGameFi — on-chain casino games";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Casino lobby card. Per-game routes override this with their own
// opengraph-image; this covers the /casino index.
export default function OpengraphImage() {
  return renderOgCard({
    eyebrow: "Wallet-native casino",
    title: "Pick a game. One on-chain house.",
    subtitle: "Dice, roulette, plinko, keno and more — paid out the instant you win.",
    stat: `${CASINO_GAME_COUNT} games`,
    tone: "cyan",
    visualKind: "casino"
  });
}
