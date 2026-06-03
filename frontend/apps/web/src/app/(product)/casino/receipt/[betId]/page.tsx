import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadEmbeddedRelease } from "@ssot/ssot/release";
import type { BetRow } from "@ssot/ssot/indexer";

import { buildPageMetadata } from "../../../../../i18n/metadata";
import { getRequestI18n } from "../../../../../i18n/request";
import { parseRequestChainId } from "../../../../../server/chain";
import { normalizeBetId, queryBetReceipt } from "../../../../../server/betting/recent-bets";
import { SITE_URL } from "../../../../../config/site";
import {
  formatTimestamp,
  formatTokenAmount,
  getExplorerBaseUrl,
  shortHex
} from "../../../../../features/portfolio/activity/detail/format";
import { ReceiptSharePanel } from "../../../../../features/share/ReceiptSharePanel";

export async function generateMetadata({
  params,
  searchParams
}: {
  params: Promise<{ betId: string }>;
  searchParams: Promise<{ chainId?: string }>;
}): Promise<Metadata> {
  const { betId } = await params;
  const { chainId: chainIdParam } = await searchParams;
  const { messages } = await getRequestI18n();
  const meta = buildPageMetadata(
    messages,
    "casinoReceipt",
    { betId },
    { noindex: true, path: `/casino/receipt/${betId}` }
  );
  const chainId = parseRequestChainId(chainIdParam);
  // Receipts use a *dynamic* per-bet card (the /og route), so the image is set
  // explicitly here rather than via the file-based opengraph-image convention.
  const imageUrl = `${SITE_URL}/casino/receipt/${betId}/og?chainId=${chainId}`;
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

type ReceiptTone = "win" | "loss" | "neutral";

export default async function CasinoReceiptPage({
  params,
  searchParams
}: {
  params: Promise<{ betId: string }>;
  searchParams: Promise<{ chainId?: string }>;
}) {
  const { betId: rawBetId } = await params;
  const { chainId: chainIdParam } = await searchParams;
  const { messages } = await getRequestI18n();
  const labels = messages.casino.room.receipt;
  const shareLabels = messages.casino.room.result.actions;
  const betId = safeNormalizeBetId(rawBetId);
  if (!betId) notFound();

  const chainId = parseRequestChainId(chainIdParam);
  const receipt = await queryBetReceipt({ betId, chainId });
  const releaseResult = loadEmbeddedRelease(chainId);
  const release = releaseResult.ok ? releaseResult.release : undefined;
  const row = receipt.row;

  // The share landing mirrors the in-room result dialog: a single constrained,
  // mobile-first card. Missing rows render the same card chrome so a shared link
  // never lands on an empty full-bleed page.
  if (!row) {
    return (
      <main className="mx-auto flex min-h-[100svh] max-w-md flex-col justify-center px-4 py-10">
        <article className="overflow-hidden rounded-2xl border border-border-soft bg-surface-1 shadow-e2">
          <header className="border-b border-border-soft px-4 py-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-subtle">
              {labels.eyebrow}
            </span>
          </header>
          <div className="px-5 py-8">
            <h1 className="text-2xl font-bold tracking-tight text-fg">{labels.missing.title}</h1>
            <p className="mt-3 text-sm leading-6 text-fg-muted">{labels.missing.description}</p>
          </div>
          <div className="p-3">
            <Link
              href="/casino"
              className="block w-full rounded-md border border-brand/40 bg-brand px-4 py-2.5 text-center text-xs font-bold uppercase tracking-[0.12em] text-fg-inverse shadow-e1 transition-colors hover:bg-brand-hover"
            >
              {labels.actions.casino}
            </Link>
          </div>
        </article>
      </main>
    );
  }

  const game = release?.gamesMeta?.find(
    (item) => item.gameId.toLowerCase() === row.gameId?.toLowerCase()
  );
  const asset = release?.assets.find(
    (item) => item.address.toLowerCase() === row.asset?.toLowerCase()
  );
  const decimals = asset?.decimals ?? 18;
  const symbol = asset?.symbol ?? "";
  const explorerBaseUrl = getExplorerBaseUrl(chainId);
  const txHref = explorerBaseUrl ? `${explorerBaseUrl}/tx/${row.lastTxHash}` : undefined;
  const gameHref = game?.slug ? `/casino/${game.slug}` : "/casino";
  const receiptHref = `/casino/receipt/${betId}?chainId=${chainId}`;
  const gameLabel = game?.label ?? shortHex(row.gameId);
  const net = getNetResult(row);
  const payout = getPayout(row);

  const tone: ReceiptTone =
    row.state === "finalized" && net != null
      ? net > 0n
        ? "win"
        : net < 0n
          ? "loss"
          : "neutral"
      : "neutral";

  // Lead with the signed net for a settled bet (matches the result dialog); for
  // a pending or refunded bet, lead with the amount in play instead of a fake net.
  const heroValue =
    row.state === "finalized" && net != null
      ? formatSignedNet(net, decimals, symbol)
      : formatTokenAmount(bigintFromString(row.stake), decimals, symbol);
  const stakeValue = formatTokenAmount(bigintFromString(row.stake), decimals, symbol);
  const payoutValue = formatTokenAmount(payout, decimals, symbol);
  const netValue = formatTokenAmount(net, decimals, symbol);
  const shareText = `${gameLabel} bet #${betId}: ${heroValue}`;
  const proofText = buildProofText({
    asset: asset?.symbol ?? shortHex(row.asset),
    betId,
    chainId,
    game: gameLabel,
    lastTx: txHref ?? row.lastTxHash,
    net: netValue,
    payout: payoutValue,
    player: row.player ?? "—",
    randomHash: row.randomHash,
    requestId: row.requestId ?? "—",
    stake: stakeValue,
    status: labels.status[row.state]
  });

  return (
    <main className="mx-auto flex min-h-[100svh] max-w-md flex-col justify-center px-4 py-10 sm:py-14">
      <h1 className="sr-only">{interpolate(labels.title, { betId })}</h1>
      <article className="overflow-hidden rounded-2xl border border-border-soft bg-surface-1 shadow-e2">
        {/* Header chrome — eyebrow + bet id, mirroring the room's panel header. */}
        <header className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-subtle">
            {labels.eyebrow}
          </span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-fg-subtle">
            #{betId}
          </span>
        </header>

        {/* Hero — the settled payoff, tinted by outcome. */}
        <div className="relative overflow-hidden border-b border-border-soft px-4 py-6">
          <div
            aria-hidden
            className={cx(
              "pointer-events-none absolute inset-x-6 -top-6 h-24 blur-[70px]",
              tone === "win" && "bg-success/30",
              tone === "loss" && "bg-danger/25",
              tone === "neutral" && "bg-brand/20"
            )}
          />
          <div className="relative">
            <span
              className={cx(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]",
                tone === "win" && "border-success/40 bg-success-soft text-success",
                tone === "loss" && "border-danger/40 bg-danger-soft text-danger",
                tone === "neutral" && "border-border-soft bg-surface-2 text-fg-muted"
              )}
            >
              {labels.status[row.state]}
            </span>
            <div
              className={cx(
                "mt-2 truncate font-mono text-3xl font-bold sm:text-4xl",
                tone === "win" && "text-success",
                tone === "loss" && "text-danger",
                tone === "neutral" && "text-fg"
              )}
              title={heroValue}
            >
              {heroValue}
            </div>
            <p className="mt-1.5 truncate text-xs leading-5 text-fg-muted">{gameLabel}</p>
          </div>
        </div>

        {/* Stat strip — stake / payout / net, like the result dialog. */}
        <div className="grid grid-cols-3 divide-x divide-border-soft border-b border-border-soft">
          <Stat label={labels.metrics.stake} value={stakeValue} />
          <Stat
            label={labels.metrics.payout}
            value={payoutValue}
            tone={tone === "win" ? "success" : "default"}
          />
          <Stat
            label={labels.metrics.net}
            value={netValue}
            tone={net == null ? "default" : net >= 0n ? "success" : "danger"}
          />
        </div>

        {/* Verifiable facts — collapsed by default so the card reads clean on a
            phone, one tap from the full on-chain detail. */}
        <details className="group border-b border-border-soft">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle transition-colors hover:text-fg">
            <span>{labels.proof}</span>
            <ChevronDownIcon className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="pb-1">
            <Fact label={labels.facts.game} value={gameLabel} />
            <Fact label={labels.facts.player} value={shortHex(row.player)} />
            <Fact label={labels.facts.affiliate} value={shortHex(row.pricingAffiliate)} />
            <Fact label={labels.facts.asset} value={asset?.symbol ?? shortHex(row.asset)} />
            <Fact label={labels.facts.betId} value={row.betId} />
            <Fact label={labels.facts.requestId} value={row.requestId ?? "—"} />
            <Fact label={labels.facts.randomHash} value={shortHex(row.randomHash)} />
            <Fact label={labels.facts.placedBlock} value={String(row.placedBlock ?? "—")} />
            <Fact label={labels.facts.updatedAt} value={formatTimestamp(row.updatedAt)} />
            <Fact label={labels.facts.lastEvent} value={row.lastEventName} />
            <Fact label={labels.facts.lastTx} value={shortHex(row.lastTxHash)} href={txHref} />
          </div>
        </details>

        {/* Provenance — indexed source, never confused for on-chain truth. */}
        <div className="flex items-center gap-2 border-b border-border-soft px-4 py-2.5 text-[10px] text-fg-subtle">
          <span aria-hidden className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
          <span className="truncate font-mono">
            {labels.indexed} · {receipt.source} · chain {chainId} ·{" "}
            {formatTimestamp(receipt.generatedAt)}
          </span>
        </div>

        {/* Actions — play leads; explorer + share share a thumb-friendly row. */}
        <div className="space-y-2 p-3">
          <Link
            href={gameHref}
            className="block w-full rounded-md border border-brand/40 bg-brand px-4 py-2.5 text-center text-xs font-bold uppercase tracking-[0.12em] text-fg-inverse shadow-e1 transition-colors hover:bg-brand-hover"
          >
            {labels.actions.play}
          </Link>
          <div className="grid grid-cols-2 gap-2">
            {txHref ? (
              <a
                href={txHref}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-border-soft bg-surface-2 px-4 py-2.5 text-center text-xs font-bold uppercase tracking-[0.12em] text-fg transition-colors hover:border-brand/50 hover:bg-surface-3"
              >
                {labels.actions.explorer}
              </a>
            ) : (
              <Link
                href="/casino"
                className="rounded-md border border-border-soft bg-surface-2 px-4 py-2.5 text-center text-xs font-bold uppercase tracking-[0.12em] text-fg transition-colors hover:border-brand/50 hover:bg-surface-3"
              >
                {labels.actions.casino}
              </Link>
            )}
            <ReceiptSharePanel
              fallbackUrl={receiptHref}
              labels={{
                copyProof: shareLabels.copyProof,
                copyLink: shareLabels.copyResultLink,
                linkCopied: shareLabels.linkCopied,
                nativeShare: shareLabels.nativeShare,
                proofCopied: shareLabels.proofCopied,
                share: shareLabels.share,
                telegram: shareLabels.shareToTelegram,
                whatsapp: shareLabels.shareToWhatsApp,
                x: shareLabels.shareToX
              }}
              proof={proofText}
              text={shareText}
              title={`ArbiGameFi bet #${betId}`}
              triggerClassName="h-full w-full"
            />
          </div>
        </div>
      </article>
    </main>
  );
}

function safeNormalizeBetId(value: string) {
  try {
    return normalizeBetId(value);
  } catch {
    return undefined;
  }
}

function interpolate(template: string, values: Record<string, string>) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => values[key] ?? match);
}

function bigintFromString(value?: string) {
  return value == null || value === "" ? undefined : BigInt(value);
}

function getPayout(row: BetRow) {
  if (row.state === "refunded") return bigintFromString(row.refundAmount);
  return bigintFromString(row.payout);
}

function getNetResult(row: BetRow) {
  const stake = bigintFromString(row.stake);
  const payout = getPayout(row);
  if (stake == null || payout == null) return undefined;
  return payout - stake;
}

/** Net with an explicit sign glyph (+ / −) for the hero figure. */
function formatSignedNet(value: bigint, decimals: number, symbol: string) {
  const body = formatTokenAmount(value < 0n ? -value : value, decimals, symbol);
  if (value > 0n) return `+${body}`;
  if (value < 0n) return `−${body}`;
  return body;
}

function buildProofText({
  asset,
  betId,
  chainId,
  game,
  lastTx,
  net,
  payout,
  player,
  randomHash,
  requestId,
  stake,
  status
}: {
  asset: string;
  betId: string;
  chainId: number;
  game: string;
  lastTx: string;
  net: string;
  payout: string;
  player: string;
  randomHash?: string;
  requestId: string;
  stake: string;
  status: string;
}) {
  return [
    `ArbiGameFi casino receipt #${betId}`,
    `Status: ${status}`,
    `Game: ${game}`,
    `Asset: ${asset}`,
    `Stake: ${stake}`,
    `Payout: ${payout}`,
    `Net: ${net}`,
    `Chain ID: ${chainId}`,
    `Player: ${player}`,
    `VRF request: ${requestId}`,
    `Random hash: ${randomHash ?? "—"}`,
    `Transaction: ${lastTx}`
  ].join("\n");
}

/** Local class joiner — keeps this server component free of client-lib imports. */
function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Stat({
  label,
  tone = "default",
  value
}: {
  label: string;
  tone?: "danger" | "default" | "success";
  value: string;
}) {
  return (
    <div className="min-w-0 px-3 py-3">
      <div className="truncate text-[9px] font-bold uppercase tracking-[0.14em] text-fg-subtle">
        {label}
      </div>
      <div
        className={cx(
          "mt-1 truncate font-mono text-sm font-bold",
          tone === "success" && "text-success",
          tone === "danger" && "text-danger",
          tone === "default" && "text-fg"
        )}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function Fact({ href, label, value }: { href?: string; label: string; value: string }) {
  const body = (
    <span
      className="min-w-0 flex-1 truncate text-right font-mono text-xs font-bold text-fg"
      title={value}
    >
      {value}
    </span>
  );
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2">
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-fg-subtle">
        {label}
      </span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
          {body}
        </a>
      ) : (
        body
      )}
    </div>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
