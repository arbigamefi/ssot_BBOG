import type { Metadata } from "next";

import { generatePageMetadata } from "../../../i18n/metadata";
import { AffiliatePageClient } from "./pageClient";

export function generateMetadata(): Promise<Metadata> {
  return generatePageMetadata("affiliate", undefined, { path: "/affiliate" });
}

export default function AffiliatePage() {
  return <AffiliatePageClient />;
}
