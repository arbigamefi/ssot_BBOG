import * as React from "react";
import type { Metadata } from "next";

import { generatePageMetadata } from "../../../i18n/metadata";
import { OpsPageClient } from "./pageClient";

export function generateMetadata(): Promise<Metadata> {
  return generatePageMetadata("ops");
}

export default function OpsPage() {
  return <OpsPageClient />;
}
