import * as React from "react";
import { notFound } from "next/navigation";

import { isCasinoModuleSlug } from "../../../../features/casino/modules";
import { GamePageClient } from "./pageClient";

export default async function GameRoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!isCasinoModuleSlug(slug)) {
    notFound();
  }

  return <GamePageClient slug={slug} />;
}
