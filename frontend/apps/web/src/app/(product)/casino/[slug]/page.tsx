import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isCasinoModuleSlug } from "../../../../features/casino/modules";
import { buildPageMetadata } from "../../../../i18n/metadata";
import { getRequestI18n } from "../../../../i18n/request";
import { GamePageClient } from "./pageClient";

function localizedGameName(
  messages: Awaited<ReturnType<typeof getRequestI18n>>["messages"],
  slug: string
) {
  switch (slug) {
    case "dice":
      return messages.casino.room.names.dice;
    case "roulette":
      return messages.casino.room.names.roulette;
    case "coin-toss":
      return messages.casino.room.names.coinToss;
    case "keno":
      return messages.casino.room.names.keno;
    case "plinko":
      return messages.casino.room.names.plinko;
    case "slots":
      return messages.casino.room.names.slots;
    default:
      return slug;
  }
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isCasinoModuleSlug(slug)) notFound();

  const { messages } = await getRequestI18n();
  return buildPageMetadata(messages, "casinoRoom", { game: localizedGameName(messages, slug) });
}

export default async function GameRoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!isCasinoModuleSlug(slug)) {
    notFound();
  }

  return <GamePageClient key={slug} slug={slug} />;
}
