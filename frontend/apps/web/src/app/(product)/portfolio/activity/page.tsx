import type { Metadata } from "next";

import { generatePageMetadata } from "../../../../i18n/metadata";
import { PortfolioActivityPageClient } from "./pageClient";

export function generateMetadata(): Promise<Metadata> {
  return generatePageMetadata("portfolioActivity", undefined, { noindex: true });
}

export default function PortfolioActivityPage() {
  return <PortfolioActivityPageClient />;
}
