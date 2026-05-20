import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { generatePageMetadata } from "../../../../i18n/metadata";
import { SportsbookMarketDetailPageClient } from "./pageClient";

export async function generateMetadata({
  params
}: {
  params: Promise<{ marketId: string }>;
}): Promise<Metadata> {
  const { marketId } = await params;
  if (!/^[0-9]+$/.test(marketId)) notFound();

  return generatePageMetadata("sportsbookMarket", { marketId });
}

export default async function SportsbookMarketDetailPage({
  params
}: {
  params: Promise<{ marketId: string }>;
}) {
  const { marketId } = await params;

  if (!/^[0-9]+$/.test(marketId)) {
    notFound();
  }

  return <SportsbookMarketDetailPageClient marketId={marketId} />;
}
