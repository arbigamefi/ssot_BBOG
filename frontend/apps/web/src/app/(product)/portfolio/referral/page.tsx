import type { Metadata } from "next";

import { generatePageMetadata } from "../../../../i18n/metadata";
import { ReferralPageClient } from "./pageClient";

export function generateMetadata(): Promise<Metadata> {
  return generatePageMetadata("portfolioReferral", undefined, { noindex: true });
}

export default function ReferralPage() {
  return <ReferralPageClient />;
}
