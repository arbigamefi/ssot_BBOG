import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "./og/render";

export const alt = "ArbiGameFi — verifiable casino on-chain";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Default site card — used for the homepage and any route without its own
// opengraph-image. Twitter falls back to this automatically.
export default function OpengraphImage() {
  return renderOgCard({
    eyebrow: "Wallet-native casino",
    title: "Verifiable casino on-chain.",
    subtitle: "Eight games. Every spin verifiable on-chain. Wins hit your wallet in seconds.",
    badge: "8 games"
  });
}
