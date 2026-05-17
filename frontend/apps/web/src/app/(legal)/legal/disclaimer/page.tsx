import type { Metadata } from "next";

import { LegalPage } from "../../../../features/legal/legal-page";

export const metadata: Metadata = {
  title: "Risk Disclaimer",
  description: "Risk disclaimer for ArbiGameFi on-chain gaming and bankroll participation."
};

export default function DisclaimerPage() {
  return <LegalPage slug="disclaimer" />;
}
