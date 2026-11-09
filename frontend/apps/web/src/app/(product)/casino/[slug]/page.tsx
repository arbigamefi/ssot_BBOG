import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isCasinoModuleSlug } from "../../../../features/casino/modules";
import { SITE_URL } from "../../../../config/site";
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
    case "baccarat":
      return messages.casino.room.names.baccarat;
    case "sic-bo":
      return messages.casino.room.names.sicBo;
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
  return buildPageMetadata(
    messages,
    "casinoRoom",
    { game: localizedGameName(messages, slug) },
    { path: `/casino/${slug}` }
  );
}

export default async function GameRoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!isCasinoModuleSlug(slug)) {
    notFound();
  }

  // schema.org structured data for the game room — improves crawlability and
  // links the page into the site's knowledge graph (publisher → homepage org).
  // Description is reused from page metadata so there is no duplicated copy.
  const { messages } = await getRequestI18n();
  const name = localizedGameName(messages, slug);
  const metadata = buildPageMetadata(
    messages,
    "casinoRoom",
    { game: name },
    { path: `/casino/${slug}` }
  );
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Game",
    name,
    url: `${SITE_URL}/casino/${slug}`,
    genre: "Casino",
    ...(typeof metadata.description === "string" ? { description: metadata.description } : {}),
    publisher: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "ArbiGameFi",
      url: SITE_URL
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <GamePageClient key={slug} slug={slug} />
    </>
  );
}
