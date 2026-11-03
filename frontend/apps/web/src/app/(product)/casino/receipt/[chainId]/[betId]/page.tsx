import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadEmbeddedRelease } from "@ssot/ssot/release";

import { buildPageMetadata } from "../../../../../../i18n/metadata";
import { getRequestI18n } from "../../../../../../i18n/request";
import { parseStrictRequestChainId } from "../../../../../../server/chain";
import {
  normalizeBetId,
  normalizeOptionalGameHubAddress,
  queryBetReceipt
} from "../../../../../../server/betting/recent-bets";
import { SITE_URL } from "../../../../../../config/site";
import { carbonCopyFontVariables } from "../../../../../../features/home/fonts";
import { ReceiptPage } from "../../../../../../features/receipt/receipt-page";
import { buildReceiptPageView } from "../../../../../../features/receipt/receipt-page-model";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ReceiptSearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  params,
  searchParams
}: {
  params: Promise<{ betId: string; chainId: string }>;
  searchParams: ReceiptSearchParams;
}): Promise<Metadata> {
  const { betId, chainId: rawChainId } = await params;
  const gameHub = parseReceiptGameHub((await searchParams).hub);
  const { messages } = await getRequestI18n();
  const chainId = parseStrictRequestChainId(rawChainId);
  const meta = buildPageMetadata(
    messages,
    "casinoReceipt",
    { betId },
    {
      noindex: true,
      path: `/casino/receipt/${rawChainId}/${betId}${gameHub ? `?hub=${gameHub.toLowerCase()}` : ""}`
    }
  );
  if (!chainId) return meta;

  // Old receipt images were cached as immutable before refunds were included.
  const imageUrl = `${SITE_URL}/casino/receipt/${chainId}/${betId}/og?v=refund-v1${
    gameHub ? `&hub=${gameHub.toLowerCase()}` : ""
  }`;
  meta.openGraph = {
    ...(meta.openGraph ?? {}),
    images: [{ url: imageUrl, width: 1200, height: 630, alt: `ArbiGameFi bet #${betId}` }]
  };
  meta.twitter = {
    ...(meta.twitter ?? {}),
    images: [imageUrl]
  };
  return meta;
}

export default async function CasinoReceiptPage({
  params,
  searchParams
}: {
  params: Promise<{ betId: string; chainId: string }>;
  searchParams: ReceiptSearchParams;
}) {
  const { betId: rawBetId, chainId: rawChainId } = await params;
  const gameHub = parseReceiptGameHub((await searchParams).hub);
  if (gameHub === null) notFound();
  const betId = safeNormalizeBetId(rawBetId);
  if (!betId) notFound();
  const chainId = parseStrictRequestChainId(rawChainId);
  if (!chainId) notFound();

  // A bet index that cannot be read is a state of the page, not an error page.
  const response = await queryBetReceipt({ betId, chainId, gameHub }).catch(() => null);
  const releaseResult = loadEmbeddedRelease(chainId);
  const view = buildReceiptPageView({
    chainId,
    betId,
    response,
    release: releaseResult.ok ? releaseResult.release : undefined
  });

  return (
    <div className={carbonCopyFontVariables}>
      <ReceiptPage view={view} />
    </div>
  );
}

/** The `hub` parameter: undefined when absent, null when it is not one address. */
function parseReceiptGameHub(value: string | string[] | undefined) {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return null;
  try {
    return normalizeOptionalGameHubAddress(value);
  } catch {
    return null;
  }
}

function safeNormalizeBetId(value: string) {
  try {
    return normalizeBetId(value);
  } catch {
    return undefined;
  }
}
