import type { Metadata } from "next";

import { generatePageMetadata } from "../../../../i18n/metadata";
import { PortfolioActivityPageClient } from "./pageClient";

export function generateMetadata(): Promise<Metadata> {
  return generatePageMetadata("portfolioActivity");
}

export default function PortfolioActivityPage() {
  return <PortfolioActivityPageClient />;
}
