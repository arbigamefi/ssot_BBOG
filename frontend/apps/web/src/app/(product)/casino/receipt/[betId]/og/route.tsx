import { loadEmbeddedRelease } from "@ssot/ssot/release";

import { renderOgCard } from "../../../../../og/render";
import { parseRequestChainId } from "../../../../../../server/chain";
import { normalizeBetId, queryBetReceipt } from "../../../../../../server/betting/recent-bets";
import { formatTokenAmount } from "../../../../../../features/portfolio/activity/detail/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ betId: string }> }) {
  const { betId: rawBetId } = await params;
  const url = new URL(request.url);
  const betId = safeNormalizeBetId(rawBetId);
  if (!betId) {
    return renderOgCard({
      eyebrow: "Casino receipt",
      title: "Receipt unavailable",
      subtitle: "This bet ID is not valid.",
      badge: "AGF"
    });
  }

  const chainId = parseRequestChainId(url.searchParams.get("chainId"));
  const receipt = await queryBetReceipt({ betId, chainId });
  const row = receipt.row;
  if (!row) {
    return renderOgCard({
      eyebrow: "Casino receipt",
      title: `Bet #${betId}`,
      subtitle: "Receipt not indexed yet. Check back after the bet index catches up.",
      badge: `chain ${chainId}`
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

  return renderOgCard({
    eyebrow: "Public casino receipt",
    title: `${resultLabel} ${amount}`,
    subtitle: `${game?.label ?? "Casino"} bet #${betId} · ${receipt.source} · chain ${chainId}`,
    badge: row.state
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
