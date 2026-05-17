import type { Metadata } from "next";

import { LegalPage } from "../../../../features/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing access to the ArbiGameFi frontend and wallet-native interfaces."
};

export default function TermsPage() {
  return <LegalPage slug="terms" />;
}
