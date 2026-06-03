import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "../../og/render";

export const alt = "ArbiGameFi — on-chain sportsbook";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Sportsbook card. Applies to the /sportsbook index and cascades to individual
// /sportsbook/[marketId] routes unless one defines its own image.
export default function OpengraphImage() {
  return renderOgCard({
    eyebrow: "On-chain sportsbook",
    title: "Back your call. Settle on-chain.",
    subtitle: "Back your call on live markets with transparent odds and verifiable settlement.",
    badge: "Live markets",
    stat: "1X2",
    tone: "cyan",
    visualKind: "sportsbook"
  });
}
