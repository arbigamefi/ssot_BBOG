import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "../../og/render";

export const alt = "ArbiGameFi — support & help center";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Support / help-center card.
export default function OpengraphImage() {
  return renderOgCard({
    eyebrow: "Help center",
    title: "Help for wallets, bets, and proof.",
    subtitle: "Find answers for settlement, withdrawals, receipts, and on-chain verification.",
    badge: "Help",
    stat: "FAQ",
    tone: "muted",
    visualKind: "support",
    variant: "utility",
    metrics: [
      { label: "Wallets", value: "Guides" },
      { label: "Settlement", value: "Explained" },
      { label: "Bets", value: "Verify" }
    ],
    footerItems: ["Self-serve help", "Verify on-chain", "Non-custodial"]
  });
}
