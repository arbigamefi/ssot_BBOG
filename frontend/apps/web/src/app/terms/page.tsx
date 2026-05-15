import type { Metadata } from "next";

import { LEGAL_PAGES } from "../../features/legal/content";
import { LegalPage } from "../../features/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing access to the ArbiGameFi frontend and wallet-native interfaces."
};

export default function TermsPage() {
  return <LegalPage content={LEGAL_PAGES.terms} />;
}
