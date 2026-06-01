import type { Metadata } from "next";

import { generatePageMetadata } from "../../../i18n/metadata";
import { EarnPageClient } from "./pageClient";

export function generateMetadata(): Promise<Metadata> {
  return generatePageMetadata("earn", undefined, { path: "/earn" });
}

export default function EarnPage() {
  return <EarnPageClient />;
}
