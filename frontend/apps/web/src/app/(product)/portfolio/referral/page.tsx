import type { Metadata } from "next";

import { generatePageMetadata } from "../../../../i18n/metadata";
import { ReferralPageClient } from "./pageClient";

export function generateMetadata(): Promise<Metadata> {
  return generatePageMetadata("portfolioReferral");
}

export default function ReferralPage() {
  return <ReferralPageClient />;
}
