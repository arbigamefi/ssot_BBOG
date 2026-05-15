import type { Metadata } from "next";

import { LEGAL_PAGES } from "../../../../features/legal/content";
import { LegalPage } from "../../../../features/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for the ArbiGameFi frontend and public-chain execution surfaces."
};

export default function PrivacyPage() {
  return <LegalPage content={LEGAL_PAGES.privacy} />;
}
