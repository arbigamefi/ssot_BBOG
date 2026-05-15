import * as React from "react";
import { notFound } from "next/navigation";

import { SportsbookMarketDetailPageClient } from "./pageClient";

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
