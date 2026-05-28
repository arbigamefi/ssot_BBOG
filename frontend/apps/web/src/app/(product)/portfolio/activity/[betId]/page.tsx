import * as React from "react";
import type { Metadata } from "next";

import { generatePageMetadata } from "../../../../../i18n/metadata";
import { BetDetailPageClient } from "./pageClient";

export async function generateMetadata({
  params
}: {
  params: Promise<{ betId: string }>;
}): Promise<Metadata> {
  const { betId } = await params;
  return generatePageMetadata("portfolioBetDetail", { betId }, { noindex: true });
}

export default async function BetDetailPage({ params }: { params: Promise<{ betId: string }> }) {
  const { betId } = await params;
  return <BetDetailPageClient betId={betId} />;
}
