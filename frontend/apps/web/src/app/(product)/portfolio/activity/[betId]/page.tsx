import * as React from "react";

import { BetDetailPageClient } from "./pageClient";

export default async function BetDetailPage({ params }: { params: Promise<{ betId: string }> }) {
  const { betId } = await params;
  return <BetDetailPageClient betId={betId} />;
}
