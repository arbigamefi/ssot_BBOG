import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "./og/render";

export const alt = "ArbiGameFi — verifiable casino on-chain";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Default site card — used for the homepage and any route without its own
// opengraph-image. Twitter falls back to this automatically.
export default function OpengraphImage() {
  return renderOgCard({
    eyebrow: "Provably fair · On-chain",
    title: "Play the house. Keep the proof.",
    subtitle: "Wallet-native casino games with VRF-backed results and public receipts.",
    badge: "Game rooms",
    stat: "Rooms",
    tone: "cyan",
    visualKind: "casino"
  });
}
