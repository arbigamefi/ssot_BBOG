import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "../../og/render";

export const alt = "ArbiGameFi — casino payout pools";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpengraphImage() {
  return renderOgCard({
    eyebrow: "Casino payout pools",
    title: "Payout capital, on-chain.",
    subtitle:
      "LPs back casino payouts, share 50% of the house edge, and carry game-result risk. Deposits are immediate; redemptions settle in batches.",
    stat: "Bankroll LP",
    tone: "green",
    visualKind: "earn",
    footerItems: ["Reserve ledger", "Share price", "Pool exit rules"]
  });
}
