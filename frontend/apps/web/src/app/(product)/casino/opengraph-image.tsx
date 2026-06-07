import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "../../og/render";

export const alt = "ArbiGameFi — on-chain casino games";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Casino lobby card. Per-game routes override this with their own
// opengraph-image; this covers the /casino index.
export default function OpengraphImage() {
  return renderOgCard({
    eyebrow: "Wallet-native casino",
    title: "Pick a game. One on-chain house.",
    subtitle: "Casino games settled on-chain — paid to your wallet when you win.",
    stat: "live rooms",
    tone: "cyan",
    visualKind: "casino"
  });
}
