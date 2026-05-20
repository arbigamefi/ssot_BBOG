import type { Metadata } from "next";

import { LegalPage } from "../../../../features/legal/legal-page";
import { generateLegalMetadata } from "../../../../features/legal/metadata";

export function generateMetadata(): Promise<Metadata> {
  return generateLegalMetadata("privacy");
}

export default function PrivacyPage() {
  return <LegalPage slug="privacy" />;
}
