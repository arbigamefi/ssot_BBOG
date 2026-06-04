import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "../../og/render";

export const alt = "ArbiGameFi — provide bankroll liquidity";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Earn / bankroll-LP card. Static framing (no live TVL) so the image stays fast
// and never serves a stale cached number as if it were live truth.
export default function OpengraphImage() {
  return renderOgCard({
    eyebrow: "Back the house",
    title: "Earn the house edge.",
    subtitle:
      "Provide bankroll liquidity and share the casino's gross gaming revenue. Withdraw anytime.",
    stat: "Bankroll LP",
    tone: "green",
    visualKind: "earn",
    footerItems: ["Reserve ledger", "Share price", "Non-custodial"]
  });
}
