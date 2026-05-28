import type { Metadata } from "next";

import { generatePageMetadata } from "../../../../i18n/metadata";
import { ClaimsPageClient } from "./pageClient";

export function generateMetadata(): Promise<Metadata> {
  return generatePageMetadata("portfolioClaims", undefined, { noindex: true });
}

export default function ClaimsPage() {
  return <ClaimsPageClient />;
}
