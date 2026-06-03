import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "../../og/render";

export const alt = "ArbiGameFi — partner & affiliate program";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Partner / affiliate card — the referral and partnership landing surface.
export default function OpengraphImage() {
  return renderOgCard({
    eyebrow: "Partner program",
    title: "Refer players. Earn from volume.",
    subtitle: "Share your link and track referred casino activity with on-chain attribution.",
    badge: "Revenue share",
    stat: "ref",
    tone: "green",
    visualKind: "affiliate",
    footerItems: ["On-chain payouts", "Transparent tracking", "Non-custodial"]
  });
}
