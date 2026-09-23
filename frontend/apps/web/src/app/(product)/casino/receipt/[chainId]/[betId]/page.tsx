import { getCasinoFinancials } from "@ssot/bet-index/financials";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadEmbeddedRelease } from "@ssot/ssot/release";

import { buildPageMetadata } from "../../../../../../i18n/metadata";
import { getRequestI18n } from "../../../../../../i18n/request";
import { parseStrictRequestChainId } from "../../../../../../server/chain";
import { normalizeBetId, queryBetReceipt } from "../../../../../../server/betting/recent-bets";
import { SITE_URL } from "../../../../../../config/site";
import {
  formatTimestamp,
  shortHex
} from "../../../../../../features/portfolio/activity/detail/format";
import { ReceiptSharePanel } from "../../../../../../features/share/ReceiptSharePanel";
import { getCasinoGamePresentation } from "../../../../../../features/casino/game-presentation";
import {
  buildCasinoReceiptFromBetRow,
  buildCasinoReceiptProofText
} from "../../../../../../features/casino/receipt/view-model";
import { PageTransition } from "../../../../../../components/PageTransition";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params
}: {
  params: Promise<{ betId: string; chainId: string }>;
}): Promise<Metadata> {
  const { betId, chainId: rawChainId } = await params;
  const { messages } = await getRequestI18n();
  const chainId = parseStrictRequestChainId(rawChainId);
  const meta = buildPageMetadata(
    messages,
    "casinoReceipt",
    { betId },
    { noindex: true, path: `/casino/receipt/${rawChainId}/${betId}` }
  );
  if (!chainId) return meta;

  // Old receipt images were cached as immutable before refunds were included.
  const imageUrl = `${SITE_URL}/casino/receipt/${chainId}/${betId}/og?v=refund-v1`;
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
  params
}: {
  params: Promise<{ betId: string; chainId: string }>;
}) {
  const { betId: rawBetId, chainId: rawChainId } = await params;
  const { messages } = await getRequestI18n();
  const labels = messages.casino.room.receipt;
  const shareLabels = messages.casino.room.result.actions;
  const betId = safeNormalizeBetId(rawBetId);
  if (!betId) notFound();

  const chainId = parseStrictRequestChainId(rawChainId);
  if (!chainId) notFound();

  const receipt = await queryBetReceipt({
    betId,
    chainId
  });
  const releaseResult = loadEmbeddedRelease(chainId);
  const release = releaseResult.ok ? releaseResult.release : undefined;
  const row = receipt.row;

  // The share landing mirrors the in-room result dialog: a single constrained,
  // mobile-first card. Missing rows render the same card chrome so a shared link
  // never lands on an empty full-bleed page.
  if (!row || !getCasinoFinancials(row)) {
    return (
      <PageTransition className="mx-auto w-full max-w-md py-4 sm:py-8">
        <article className="overflow-hidden rounded-lg border border-border-soft bg-surface-1 shadow-e2">
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
              href={`/casino?chainId=${chainId}`}
              className="block w-full rounded-md border border-brand/40 bg-brand px-4 py-2.5 text-center text-xs font-bold uppercase tracking-[0.12em] text-fg-inverse shadow-e1 transition-colors hover:bg-brand-hover"
            >
              {labels.actions.casino}
            </Link>
          </div>
        </article>
      </PageTransition>
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
  const gameHref = `${game?.slug ? `/casino/${game.slug}` : "/casino"}?chainId=${chainId}`;
  const gameLabel = game?.label ?? shortHex(row.gameId);
  const gamePresentation = getCasinoGamePresentation(game?.slug);
  const receiptModel = buildCasinoReceiptFromBetRow({
    assetDecimals: decimals,
    assetSymbol: symbol,
    chainId,
    gameLabel,
    gameSlug: game?.slug,
    row
  });
  const tone = receiptModel.tone;

  // Lead with the same signed net shown in the in-room result dialog.
  const heroValue = receiptModel.signedNetValue;
  const receiptHref = `/casino/receipt/${chainId}/${betId}`;
  const shareText = receiptModel.shareText;
  const proofText = buildCasinoReceiptProofText({
    assetLabel: asset?.symbol ?? shortHex(row.asset),
    lastTx: receiptModel.txHref ?? receiptModel.terminalTxHash ?? row.lastTxHash,
    model: receiptModel,
    status: labels.status[row.state]
  });

  return (
    <PageTransition className="mx-auto w-full max-w-md overflow-x-hidden py-4 sm:py-8">
      <h1 className="sr-only">{interpolate(labels.title, { betId })}</h1>
      <article className="w-full min-w-0 overflow-hidden rounded-lg border border-border-soft bg-surface-1 shadow-e2">
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
          {gamePresentation ? (
            <ReceiptGameTexture slug={gamePresentation.slug} tone={tone} />
          ) : null}
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
        <div className="grid min-w-0 grid-cols-3 divide-x divide-border-soft border-b border-border-soft">
          <Stat label={labels.metrics.stake} value={receiptModel.stakeValue} />
          <Stat
            label={labels.metrics.payout}
            value={receiptModel.payoutValue}
            tone={tone === "win" ? "success" : "default"}
          />
          <Stat
            label={labels.metrics.net}
            value={receiptModel.netValue}
            tone={receiptModel.net >= 0n ? "success" : "danger"}
          />
        </div>

        {/* Verifiable facts — collapsed by default so the card reads clean on a
            phone, one tap from the full on-chain detail. */}
        <details className="group min-h-0 border-b border-border-soft">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle transition-colors hover:text-fg">
            <span>{labels.proof}</span>
            <ChevronDownIcon className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="max-h-[32svh] min-h-0 min-w-0 overflow-y-auto overscroll-contain pb-1 sm:max-h-72">
            <Fact label={labels.facts.game} value={gameLabel} />
            <Fact label={labels.facts.player} value={shortHex(receiptModel.player)} />
            <Fact label={labels.facts.affiliate} value={shortHex(receiptModel.pricingAffiliate)} />
            <Fact label={labels.facts.asset} value={asset?.symbol ?? shortHex(row.asset)} />
            <Fact label={labels.facts.betId} value={receiptModel.betId} />
            <Fact label={labels.facts.requestId} value={receiptModel.requestId ?? "—"} />
            <Fact label={labels.facts.randomHash} value={shortHex(receiptModel.randomHash)} />
            <Fact
              label={labels.facts.placedBlock}
              value={String(receiptModel.placedBlock ?? "—")}
            />
            <Fact label={labels.facts.updatedAt} value={formatTimestamp(receiptModel.updatedAt)} />
            <Fact label={labels.facts.lastEvent} value={receiptModel.lastEventName ?? "—"} />
            <Fact
              label={labels.facts.lastTx}
              value={shortHex(receiptModel.terminalTxHash)}
              href={receiptModel.txHref}
            />
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
        <div className="min-w-0 shrink-0 space-y-2 p-3">
          <Link
            href={gameHref}
            className="block w-full rounded-md border border-brand/40 bg-brand px-4 py-2.5 text-center text-xs font-bold uppercase tracking-[0.12em] text-fg-inverse shadow-e1 transition-colors hover:bg-brand-hover"
          >
            {labels.actions.play}
          </Link>
          <div className="grid min-w-0 grid-cols-2 gap-2">
            {receiptModel.txHref ? (
              <a
                href={receiptModel.txHref}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-border-soft bg-surface-2 px-4 py-2.5 text-center text-xs font-bold uppercase tracking-[0.12em] text-fg transition-colors hover:border-brand/50 hover:bg-surface-3"
              >
                {labels.actions.explorer}
              </a>
            ) : (
              <Link
                href={`/casino?chainId=${chainId}`}
                className="rounded-md border border-border-soft bg-surface-2 px-4 py-2.5 text-center text-xs font-bold uppercase tracking-[0.12em] text-fg transition-colors hover:border-brand/50 hover:bg-surface-3"
              >
                {labels.actions.casino}
              </Link>
            )}
            <ReceiptSharePanel
              fallbackUrl={receiptHref}
              labels={{
                close: shareLabels.close,
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
    </PageTransition>
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
      className="block min-w-0 max-w-full truncate text-right font-mono text-xs font-bold text-fg"
      title={value}
    >
      {value}
    </span>
  );
  return (
    <div className="grid min-w-0 grid-cols-[6.75rem_minmax(0,1fr)] items-center gap-3 px-4 py-2">
      <span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-fg-subtle">
        {label}
      </span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="min-w-0">
          {body}
        </a>
      ) : (
        body
      )}
    </div>
  );
}

function ReceiptGameTexture({ slug, tone }: { slug: string; tone: ReceiptTone }) {
  return (
    <div
      aria-hidden
      className={cx(
        "pointer-events-none absolute inset-y-0 right-0 z-0 flex w-[48%] items-center justify-center overflow-hidden",
        tone === "win" && "text-success",
        tone === "loss" && "text-danger",
        tone === "neutral" && "text-brand"
      )}
    >
      <svg
        viewBox="0 0 180 180"
        className="h-40 w-40 translate-x-5 rotate-[-8deg] opacity-[0.14] sm:h-44 sm:w-44 sm:translate-x-3 sm:opacity-[0.16]"
        fill="none"
      >
        {renderReceiptGameTexture(slug)}
      </svg>
    </div>
  );
}

function renderReceiptGameTexture(slug: string) {
  switch (slug) {
    case "plinko":
      return (
        <>
          <path
            d="M44 28h92a16 16 0 0 1 16 16v96a16 16 0 0 1-16 16H44a16 16 0 0 1-16-16V44a16 16 0 0 1 16-16Z"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            d="M88 34c10 22-26 36-6 58 17 19-12 31 7 54"
            stroke="currentColor"
            strokeWidth="5"
          />
          {[
            [58, 62],
            [90, 62],
            [122, 62],
            [74, 84],
            [106, 84],
            [58, 106],
            [90, 106],
            [122, 106],
            [74, 128],
            [106, 128]
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5" fill="currentColor" opacity="0.55" />
          ))}
          <path
            d="M52 144h76"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.75"
          />
        </>
      );
    case "roulette":
      return (
        <>
          <circle cx="90" cy="90" r="62" stroke="currentColor" strokeWidth="4" />
          <circle cx="90" cy="90" r="30" stroke="currentColor" strokeWidth="4" />
          <path
            d="M90 28v124M28 90h124M47 47l86 86M133 47l-86 86"
            stroke="currentColor"
            strokeWidth="3"
            opacity="0.5"
          />
          <circle cx="128" cy="46" r="8" fill="currentColor" />
        </>
      );
    case "dice":
    case "sic-bo":
      return (
        <>
          <rect
            x="34"
            y="42"
            width="70"
            height="70"
            rx="14"
            stroke="currentColor"
            strokeWidth="4"
          />
          <rect
            x="78"
            y="70"
            width="70"
            height="70"
            rx="14"
            stroke="currentColor"
            strokeWidth="4"
            opacity="0.72"
          />
          {[58, 82, 102, 122].map((cx, index) => (
            <circle key={cx} cx={cx} cy={index < 2 ? 66 : 116} r="5" fill="currentColor" />
          ))}
          <circle cx="113" cy="105" r="5" fill="currentColor" opacity="0.72" />
        </>
      );
    case "coin-toss":
      return (
        <>
          <circle cx="76" cy="88" r="50" stroke="currentColor" strokeWidth="5" />
          <circle cx="112" cy="92" r="50" stroke="currentColor" strokeWidth="5" opacity="0.65" />
          <path
            d="M56 88h40M76 68v40M96 92h32"
            stroke="currentColor"
            strokeWidth="7"
            strokeLinecap="round"
          />
        </>
      );
    case "keno":
      return (
        <>
          <rect
            x="34"
            y="34"
            width="112"
            height="112"
            rx="18"
            stroke="currentColor"
            strokeWidth="4"
          />
          {Array.from({ length: 20 }, (_, index) => {
            const col = index % 5;
            const row = Math.floor(index / 5);
            return (
              <circle
                key={index}
                cx={55 + col * 18}
                cy={58 + row * 20}
                r="5"
                fill="currentColor"
                opacity={index % 4 === 0 ? 0.85 : 0.45}
              />
            );
          })}
        </>
      );
    case "slots":
      return (
        <>
          <rect
            x="32"
            y="42"
            width="116"
            height="96"
            rx="18"
            stroke="currentColor"
            strokeWidth="4"
          />
          {[54, 90, 126].map((cx) => (
            <rect
              key={cx}
              x={cx - 13}
              y="60"
              width="26"
              height="60"
              rx="8"
              stroke="currentColor"
              strokeWidth="4"
            />
          ))}
          <path
            d="M152 68h14v42h-14"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    case "baccarat":
      return (
        <>
          <rect
            x="42"
            y="46"
            width="48"
            height="70"
            rx="10"
            stroke="currentColor"
            strokeWidth="4"
            transform="rotate(-10 66 81)"
          />
          <rect
            x="92"
            y="58"
            width="48"
            height="70"
            rx="10"
            stroke="currentColor"
            strokeWidth="4"
            transform="rotate(9 116 93)"
            opacity="0.72"
          />
          <path d="M54 138h74" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
          <circle cx="68" cy="76" r="6" fill="currentColor" />
          <circle cx="116" cy="92" r="6" fill="currentColor" opacity="0.72" />
        </>
      );
    default:
      return (
        <>
          <circle cx="90" cy="90" r="58" stroke="currentColor" strokeWidth="4" />
          <path
            d="M54 90h72M90 54v72"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </>
      );
  }
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
