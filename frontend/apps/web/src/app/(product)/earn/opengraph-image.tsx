import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "../../og/render";

export const alt = "ArbiGameFi — casino payout pools";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Pools / bankroll-LP card. Static framing (no live TVL) so the image stays fast
// and never serves a stale cached number as if it were live truth. The copy states
// the v1.5 terms: LPs carry result variance, the house edge is not an LP share,
// and exits follow pool rules rather than "anytime".
export default function OpengraphImage() {
  return renderOgCard({
    eyebrow: "Casino payout pools",
    title: "Payout capital, on-chain.",
    subtitle:
      "LPs back casino payouts and carry the variance of game results. Under v1.5 the house edge funds protocol fees and referral rewards, not LP shares.",
    stat: "Bankroll LP",
    tone: "green",
    visualKind: "earn",
    footerItems: ["Reserve ledger", "Share price", "Pool exit rules"]
  });
}
