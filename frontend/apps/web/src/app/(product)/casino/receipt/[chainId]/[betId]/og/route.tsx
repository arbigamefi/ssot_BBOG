import { loadEmbeddedRelease } from "@ssot/ssot/release";

import {
  OG_IMMUTABLE_CACHE_HEADERS,
  OG_NO_STORE_HEADERS,
  renderOgCard
} from "../../../../../../og/render";
import { parseStrictRequestChainId } from "../../../../../../../server/chain";
import { normalizeBetId, queryBetReceipt } from "../../../../../../../server/betting/recent-bets";
import { formatTokenAmount } from "../../../../../../../features/portfolio/activity/detail/format";
import { getCasinoGamePresentation } from "../../../../../../../features/casino/game-presentation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RECEIPT_OG_PENDING_HEADERS = OG_NO_STORE_HEADERS;
const RECEIPT_OG_TERMINAL_HEADERS = OG_IMMUTABLE_CACHE_HEADERS;
const RECEIPT_OG_NOT_READY_HEADERS = {
  ...OG_NO_STORE_HEADERS,
  "Retry-After": "5"
} as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ betId: string; chainId: string }> }
) {
  const { betId: rawBetId, chainId: rawChainId } = await params;
  const betId = safeNormalizeBetId(rawBetId);
  const chainId = parseStrictRequestChainId(rawChainId);
  if (!betId || !chainId) {
    return renderOgCard({
      eyebrow: "Casino receipt",
      title: "Receipt unavailable",
      subtitle: "This receipt path is not valid.",
      badge: "AGF",
      tone: "muted",
      visualKind: "receipt",
      variant: "receipt",
      headers: RECEIPT_OG_PENDING_HEADERS
    });
  }

  const receipt = await queryBetReceipt({
    betId,
    chainId
  });
  const row = receipt.row;
  if (!row) {
    return new Response("Receipt not ready", {
      headers: RECEIPT_OG_NOT_READY_HEADERS,
      status: 503
    });
  }

  const releaseResult = loadEmbeddedRelease(chainId);
  const release = releaseResult.ok ? releaseResult.release : undefined;
  const game = release?.gamesMeta?.find(
    (item) => item.gameId.toLowerCase() === row.gameId?.toLowerCase()
  );
  const asset = release?.assets.find(
    (item) => item.address.toLowerCase() === row.asset?.toLowerCase()
  );
  const decimals = asset?.decimals ?? 18;
  const symbol = asset?.symbol ?? "";
  const payout = getPayout(row);
  const stake = bigintFromString(row.stake);
  const net = stake != null && payout != null ? payout - stake : undefined;
  const resultLabel =
    row.state === "finalized"
      ? net != null && net >= 0n
        ? "Won"
        : "Settled"
      : row.state === "refunded"
        ? "Refunded"
        : row.state === "randomReady"
          ? "Randomness ready"
          : "Bet placed";
  const amount = formatTokenAmount(net ?? payout ?? stake, decimals, symbol, 2);
  const tone =
    row.state === "refunded"
      ? "warning"
      : row.state === "finalized"
        ? net != null && net >= 0n
          ? "success"
          : "red"
        : row.state === "randomReady"
          ? "brand"
          : "muted";
  const gameVisual = getCasinoGamePresentation(game?.slug)?.visualKind;

  return renderOgCard({
    eyebrow: "Public casino receipt",
    title: `${resultLabel} ${amount}`,
    subtitle: `${game?.label ?? "Casino"} bet #${betId} · ${receipt.source} · chain ${chainId}`,
    badge: row.state,
    stat: row.state === "finalized" ? amount : row.state,
    tone,
    visualKind: gameVisual ?? "receipt",
    variant: "receipt",
    metrics: [
      { label: "Game", value: game?.label ?? "Casino" },
      { label: "Chain", value: String(chainId) },
      { label: "Source", value: receipt.source }
    ],
    footerItems: ["Public receipt", "Indexed data", "Verify on explorer"],
    headers: RECEIPT_OG_TERMINAL_HEADERS
  });
}

function safeNormalizeBetId(value: string) {
  try {
    return normalizeBetId(value);
  } catch {
    return undefined;
  }
}

function bigintFromString(value?: string) {
  return value == null || value === "" ? undefined : BigInt(value);
}

function getPayout(row: { payout?: string; refundAmount?: string; state: string }) {
  if (row.state === "refunded") return bigintFromString(row.refundAmount);
  return bigintFromString(row.payout);
}
