import * as React from "react";
import type { Metadata } from "next";

import { generatePageMetadata } from "../../../../i18n/metadata";
import { OpsSportsbookPageClient } from "./pageClient";

export function generateMetadata(): Promise<Metadata> {
  return generatePageMetadata("opsSportsbook", undefined, { noindex: true });
}

export default function OpsSportsbookPage() {
  return <OpsSportsbookPageClient />;
}
