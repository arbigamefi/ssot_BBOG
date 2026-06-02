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
  const imageUrl = `${SITE_URL}/casino/receipt/${betId}/og?chainId=${chainId}`;
  meta.openGraph = {
    ...(meta.openGraph ?? {}),
    images: [{ url: imageUrl, width: 1200, height: 630, alt: `ArbiGameFi bet #${betId}` }]
  };
  meta.twitter = {
    ...(meta.twitter ?? {}),
    card: "summary_large_image",
    images: [imageUrl]
  };
  return meta;
}

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

  if (!row) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center px-4 py-24">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">{labels.eyebrow}</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-fg">{labels.missing.title}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-fg-muted">
          {labels.missing.description}
        </p>
        <div className="mt-8">
          <Link
            href="/casino"
            className="inline-flex rounded-md border border-border-soft bg-surface-2 px-4 py-2 text-sm font-bold text-fg transition-colors hover:border-brand/50 hover:bg-surface-3"
          >
            {labels.actions.casino}
          </Link>
        </div>
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
  const net = getNetResult(row);

  return (
    <main className="mx-auto max-w-6xl px-4 py-24">
      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">
            {labels.eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-fg md:text-6xl">
            {interpolate(labels.title, { betId })}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-fg-muted">{labels.description}</p>
        </div>
        <div className="rounded-md border border-border-soft bg-surface-1 p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-subtle">
            {labels.indexed}
          </div>
          <div className="mt-2 font-mono text-sm font-bold text-fg">
            {receipt.source} · chain {chainId}
          </div>
          <div className="mt-1 text-xs text-fg-muted">{formatTimestamp(receipt.generatedAt)}</div>
        </div>
      </section>

      <section className="mt-8 grid gap-3 md:grid-cols-4">
        <Metric label={labels.metrics.state} value={labels.status[row.state]} />
        <Metric
          label={labels.metrics.stake}
          value={formatTokenAmount(bigintFromString(row.stake), decimals, symbol)}
        />
        <Metric
          label={labels.metrics.payout}
          value={formatTokenAmount(getPayout(row), decimals, symbol)}
        />
        <Metric
          label={labels.metrics.net}
          value={formatTokenAmount(net, decimals, symbol)}
          tone={net == null ? "default" : net >= 0n ? "success" : "danger"}
        />
      </section>

      <section className="mt-8 rounded-lg border border-border-soft bg-surface-1">
        <Fact label={labels.facts.game} value={game?.label ?? shortHex(row.gameId)} />
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
      </section>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href={gameHref}
          className="rounded-md bg-brand px-5 py-3 text-center text-sm font-bold uppercase tracking-[0.12em] text-fg-inverse transition-colors hover:bg-brand-hover"
        >
          {labels.actions.play}
        </Link>
        {txHref ? (
          <a
            href={txHref}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-border-soft bg-surface-2 px-5 py-3 text-center text-sm font-bold uppercase tracking-[0.12em] text-fg transition-colors hover:border-brand/50 hover:bg-surface-3"
          >
            {labels.actions.explorer}
          </a>
        ) : null}
        <ReceiptSharePanel
          fallbackUrl={receiptHref}
          labels={{
            copyLink: shareLabels.copyResultLink,
            linkCopied: shareLabels.linkCopied,
            nativeShare: shareLabels.nativeShare,
            share: shareLabels.share,
            telegram: shareLabels.shareToTelegram,
            whatsapp: shareLabels.shareToWhatsApp,
            x: shareLabels.shareToX
          }}
          text={`${game?.label ?? "Casino"} bet #${betId}`}
          title={`ArbiGameFi bet #${betId}`}
          triggerClassName="h-full"
        />
      </div>
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

function Metric({
  label,
  tone = "default",
  value
}: {
  label: string;
  tone?: "danger" | "default" | "success";
  value: string;
}) {
  return (
    <div className="rounded-md border border-border-soft bg-surface-1 p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
        {label}
      </div>
      <div
        className={[
          "mt-2 truncate font-mono text-xl font-bold",
          tone === "success" ? "text-success" : "",
          tone === "danger" ? "text-danger" : "",
          tone === "default" ? "text-fg" : ""
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function Fact({ href, label, value }: { href?: string; label: string; value: string }) {
  const body = (
    <span className="min-w-0 flex-1 truncate text-right font-mono text-sm font-bold text-fg">
      {value}
    </span>
  );
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border-soft px-4 py-3 last:border-b-0">
      <span className="shrink-0 text-xs font-bold uppercase tracking-[0.14em] text-fg-subtle">
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
