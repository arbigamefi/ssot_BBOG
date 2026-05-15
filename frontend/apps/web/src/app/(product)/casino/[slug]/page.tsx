import * as React from "react";

import { GamePageClient } from "./pageClient";

const SLUG_ALIASES: Record<string, string> = {
  cointoss: "coin-toss"
};

export default async function GameRoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <GamePageClient slug={SLUG_ALIASES[slug] ?? slug} />;
}
