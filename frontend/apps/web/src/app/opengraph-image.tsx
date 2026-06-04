import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "./og/render";
import { CASINO_GAME_COUNT } from "../features/casino/game-presentation";

export const alt = "ArbiGameFi — verifiable casino on-chain";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Default site card — used for the homepage and any route without its own
// opengraph-image. Twitter falls back to this automatically.
export default function OpengraphImage() {
  return renderOgCard({
    eyebrow: "Provably fair · On-chain",
    title: "Every win, paid to your wallet.",
    subtitle: "On-chain casino games. No signup, no custody, results you can verify.",
    stat: `${CASINO_GAME_COUNT} games`,
    tone: "cyan",
    visualKind: "casino"
  });
}
