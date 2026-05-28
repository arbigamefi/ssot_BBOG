import type { Metadata } from "next";

import { generatePageMetadata } from "../../../i18n/metadata";
import { PortfolioPageClient } from "./pageClient";

export function generateMetadata(): Promise<Metadata> {
  return generatePageMetadata("portfolio", undefined, { noindex: true });
}

export default function PortfolioPage() {
  return <PortfolioPageClient />;
}
