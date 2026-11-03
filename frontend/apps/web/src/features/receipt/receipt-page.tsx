"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import type { Address } from "@ssot/ssot/sdk";

import { getCasinoAccess } from "../../app-shell/casino-access";
import { getAppChain, getExplorerAddressUrl } from "../../app-shell/chain-registry";
import { useSSOTSDK } from "../../ssot/sdk";
import { readCasinoOutcome } from "../casino/room/outcome";
import { buildShareUrl } from "../share/share-link";
import { describeOutcome } from "./outcome";
import { PrintedReceipt, RECEIPT_LINK, type ReceiptProofRow } from "./printed-receipt";
import { exactAmount, shortId } from "./receipt";
import { ReceiptClaim } from "./receipt-claim";
import type { ReceiptPageBet, ReceiptPageView } from "./receipt-page-model";
import { buildReceiptPath } from "./receipt-path";

const SECTION_GRID =
  "mx-auto box-content grid max-w-page grid-cols-1 gap-x-columns px-gutter lg:grid-cols-12";
const FOCUS_ON_CARBON =
  "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-paper";
/** The one filled button on carbon is paper; ink never sits on carbon. */
const PAPER_BUTTON = `inline-grid min-h-12 place-items-center rounded-print bg-paper px-5 font-semibold whitespace-nowrap text-ink hover:bg-on-carbon-muted ${FOCUS_ON_CARBON}`;
const OUTLINE_ON_CARBON = `inline-grid min-h-12 place-items-center rounded-sheet border border-current px-5 font-semibold whitespace-nowrap text-paper hover:bg-paper hover:text-ink ${FOCUS_ON_CARBON}`;
/** How often a page waiting on its bet asks the server again. */
const PENDING_REFRESH_MS = 10_000;

function gameKey(slug: string) {
  return slug.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function useGameName(bet: ReceiptPageBet) {
  const t = useTranslations("casino.room.names");
  if (!bet.gameSlug) return bet.gameLabel;
  const key = gameKey(bet.gameSlug);
  return t.has(key) ? t(key) : bet.gameLabel;
}

/**
 * What the chain holds beyond the index: the randomness fee charged and what the game drew. Read
 * only for a bet of the release this site runs, whose GameHub the SDK reads.
 */
function useChainFacts(bet: ReceiptPageBet, enabled: boolean) {
  const { sdk } = useSSOTSDK();
  const sameHub = Boolean(
    sdk &&
    bet.gameHub &&
    sdk.release.chainId === bet.chainId &&
    sdk.release.contracts.gameHub === bet.gameHub
  );
  return useQuery({
    queryKey: ["receipt", "chain", bet.chainId, bet.gameHub, bet.betId],
    enabled: enabled && sameHub,
    staleTime: Infinity,
    retry: 1,
    queryFn: async () => {
      const gameHub = sdk!.gameHub;
      const onChain = await gameHub.getBet(BigInt(bet.betId));
      const outcome = await readCasinoOutcome({ gameHub, bet: onChain, gameSlug: bet.gameSlug });
      return { fee: onChain.vrfFeeCharged, outcome };
    }
  });
}

/** The public receipt of one bet, in Carbon copy: the printed receipt, then where its facts come from. */
export function ReceiptPage({ view }: { view: ReceiptPageView }) {
  const t = useTranslations("receipt.page");
  const { bet } = view;
  const access = getCasinoAccess(bet.chainId);
  const chainName = getAppChain(bet.chainId)?.name ?? String(bet.chainId);
  const game = useGameName(bet);

  return (
    <div className="bg-carbon font-text text-body text-paper">
      {access === "testnet" ? (
        <p className="border-b border-rule-carbon bg-carbon-deep py-2 text-note text-on-carbon-muted">
          <span className="mx-auto box-content block max-w-page px-gutter">
            {t("testnet", { chain: chainName })}
          </span>
        </p>
      ) : null}
      <div className={`${SECTION_GRID} gap-y-10 pt-4 pb-section`}>
        <div className="lg:col-span-5">
          <Link
            href={`/casino?chainId=${bet.chainId}`}
            className={`text-note text-on-carbon-muted hover:text-paper ${FOCUS_ON_CARBON}`}
          >
            {t("crumb")}
          </Link>
          <h1 className="mt-2 text-heading font-extrabold text-balance break-keep">
            {t(`title.${view.kind}`, { id: bet.betId })}
          </h1>
          <p className="mt-4 max-w-[34em] text-lede text-on-carbon-muted">
            {lede(view, t, game ?? t("aGame"), chainName)}
          </p>
          <Actions view={view} game={game} />
        </div>
        {view.kind === "printed" || view.kind === "pending" || view.kind === "indexing" ? (
          <div className="w-full max-w-[480px] lg:col-span-6 lg:col-start-7 lg:justify-self-end">
            <div aria-hidden="true" className="print-slot relative z-10 h-4" />
            <div className="-mt-2 mx-4 overflow-hidden pb-6">
              {view.kind === "printed" ? (
                <Printed view={view} game={game ?? "—"} chainName={chainName} />
              ) : (
                <Printing view={view} game={game ?? "—"} chainName={chainName} />
              )}
            </div>
          </div>
        ) : null}
      </div>
      {view.kind === "printed" ? <Details view={view} /> : null}
      {view.kind === "pending" || view.kind === "indexing" ? <RefreshWhileWaiting /> : null}
    </div>
  );
}

function lede(
  view: ReceiptPageView,
  t: ReturnType<typeof useTranslations>,
  game: string,
  chain: string
) {
  switch (view.kind) {
    case "printed":
      return t("lede.printed", { game, chain });
    case "pending":
      return t(`lede.${view.state}`, { game, chain });
    case "indexing":
      return t("lede.indexing", { chain });
    case "missing":
      return t("lede.missing", { chain });
    case "degraded":
      return t("lede.degraded");
  }
}

function Actions({ view, game }: { view: ReceiptPageView; game?: string }) {
  const t = useTranslations("receipt.page");
  const router = useRouter();
  const { bet } = view;
  const gameHref = `${bet.gameSlug ? `/casino/${bet.gameSlug}` : "/casino"}?chainId=${bet.chainId}`;
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      {view.kind === "degraded" ? (
        <button type="button" onClick={() => router.refresh()} className={PAPER_BUTTON}>
          {t("retry")}
        </button>
      ) : (
        <Link href={gameHref} className={PAPER_BUTTON}>
          {game && bet.gameSlug ? t("play", { game }) : t("casino")}
        </Link>
      )}
      {view.kind === "printed" ? <CopyLink bet={bet} /> : null}
      {view.kind === "pending" ? (
        <Link
          href={`/portfolio/activity/${bet.betId}?chainId=${bet.chainId}`}
          className={OUTLINE_ON_CARBON}
        >
          {t("activity")}
        </Link>
      ) : null}
    </div>
  );
}

function CopyLink({ bet }: { bet: ReceiptPageBet }) {
  const t = useTranslations("receipt.page");
  const { sdk } = useSSOTSDK();
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    const path = buildReceiptPath({ betId: bet.betId, chainId: bet.chainId, gameHub: bet.gameHub });
    const url = buildShareUrl({
      href: new URL(path, window.location.origin).toString(),
      referrer: sdk?.account
    });
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <>
      <button type="button" onClick={() => void copy()} className={OUTLINE_ON_CARBON}>
        {t("copy")}
      </button>
      <span role="status" className="text-note text-on-carbon-muted">
        {copied ? t("copied") : ""}
      </span>
    </>
  );
}

function Printed({
  view,
  game,
  chainName
}: {
  view: Extract<ReceiptPageView, { kind: "printed" }>;
  game: string;
  chainName: string;
}) {
  const t = useTranslations("receipt");
  const tRoot = useTranslations();
  const locale = useLocale();
  const { bet, receipt } = view;
  const chain = useChainFacts(bet, true);
  const outcome = chain.data?.outcome;
  const sentences = outcome ? describeOutcome(outcome, tRoot, locale) : [];
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 });
  const proof: ReceiptProofRow[] = view.payment
    ? [{ key: "payment", label: t("proof.payment"), value: t(`payment.${view.payment}`) }]
    : [];
  const claimable =
    view.poolId != null && view.player && (receipt.stamp === "voided" || receipt.owed) ? (
      <ReceiptClaim
        chainId={bet.chainId}
        poolId={view.poolId}
        player={view.player as Address}
        symbol={bet.symbol}
        decimals={bet.decimals}
      />
    ) : null;

  return (
    <PrintedReceipt
      receipt={receipt}
      symbol={bet.symbol}
      houseEdgeRate={view.houseEdgeBps == null ? "—" : percent.format(view.houseEdgeBps / 10_000)}
      title={game}
      details={
        <>
          {sentences.map((sentence) => (
            <p key={sentence} className="mt-1 font-semibold break-keep">
              {sentence}
            </p>
          ))}
          <p className="text-note text-faded">
            {view.placedBlock == null
              ? chainName
              : t("where", { chain: chainName, block: view.placedBlock.toLocaleString("en-US") })}
          </p>
        </>
      }
      fee={chain.data ? exactAmount(chain.data.fee, 18) : null}
      proof={proof}
      className="px-5 pt-6 pb-10 motion-safe:animate-print md:px-7 md:pt-8 md:pb-11"
    >
      {claimable}
    </PrintedReceipt>
  );
}

/** A bet still on its way, or whose amounts are not all indexed: paper still printing, no stamp. */
function Printing({
  view,
  game,
  chainName
}: {
  view: Extract<ReceiptPageView, { kind: "pending" | "indexing" }>;
  game: string;
  chainName: string;
}) {
  const t = useTranslations("receipt");
  const locale = useLocale();
  const { bet } = view;
  const deadline =
    view.kind === "pending" && view.refundDeadline
      ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(view.refundDeadline)
        )
      : undefined;
  return (
    <article
      aria-label={t("label", { id: bet.betId })}
      className="print-sheet relative rounded-b-sheet px-5 pt-6 pb-6 md:px-7 md:pt-8"
    >
      <header className="flex items-baseline justify-between gap-3 text-note text-faded">
        <b className="font-semibold text-ink">ArbiGameFi</b>
        <span>{t("bet", { id: bet.betId })}</span>
      </header>
      <p className="mt-4 text-lede font-semibold">{game}</p>
      <p className="text-note text-faded">
        {view.kind === "pending" && view.placedBlock != null
          ? t("where", { chain: chainName, block: view.placedBlock.toLocaleString("en-US") })
          : chainName}
      </p>
      <hr className="my-4 border-0 border-t-2 border-dashed border-thermal" />
      <p role="status" className="font-semibold">
        {t(`printing.${view.kind === "pending" ? view.state : "indexing"}`)}
      </p>
      <div aria-hidden="true" className="print-feed mt-3 h-3 motion-safe:animate-feed" />
      {view.kind === "pending" && view.stake ? (
        <ul className="mt-4">
          <li className="flex items-baseline gap-2 py-1">
            <span>{t("lines.stake")}</span>
            <span aria-hidden="true" className="print-leader" />
            <span className="font-semibold tabular-nums">
              {view.stake} {bet.symbol}
            </span>
          </li>
        </ul>
      ) : null}
      {deadline ? (
        <p className="mt-2 text-note">{t("printing.refund", { time: deadline })}</p>
      ) : null}
      {view.kind === "pending" && view.requestId ? (
        <>
          <hr className="my-4 border-0 border-t-2 border-dashed border-thermal" />
          <dl className="grid grid-cols-[8em_minmax(0,1fr)] gap-2 text-note">
            <dt className="text-faded">{t("proof.request")}</dt>
            <dd className="font-semibold tabular-nums">{shortId(view.requestId)}</dd>
          </dl>
        </>
      ) : null}
    </article>
  );
}

/** Where the receipt's facts come from, on paper: addresses, the index, the turnover allocation. */
function Details({ view }: { view: Extract<ReceiptPageView, { kind: "printed" }> }) {
  const t = useTranslations("receipt.page.details");
  const locale = useLocale();
  const { bet, allocation } = view;
  const address = (value?: string) =>
    value ? { value: shortId(value), href: getExplorerAddressUrl(bet.chainId, value) } : null;
  const indexed = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(view.indexedAt));
  const rows = [
    { key: "player", label: t("player"), ...address(view.player) },
    { key: "referrerL1", label: t("referrerL1"), ...address(view.referrerL1) },
    { key: "referrerL2", label: t("referrerL2"), ...address(view.referrerL2) },
    {
      key: "asset",
      label: t("asset", { symbol: bet.symbol }),
      ...address(view.asset)
    },
    { key: "gameHub", label: t("gameHub"), ...address(bet.gameHub) },
    {
      key: "block",
      label: t("block"),
      value: view.placedBlock == null ? "—" : view.placedBlock.toLocaleString("en-US")
    },
    { key: "event", label: t("event"), value: view.lastEventName },
    {
      key: "indexed",
      label: t("indexed"),
      value: t(`source.${view.source}`, { time: indexed })
    }
  ];
  const percent = allocation
    ? new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(
        allocation.rateBps / 10_000
      )
    : "";

  return (
    <section aria-labelledby="receipt-details-title" className="bg-paper py-section text-carbon">
      <div className={SECTION_GRID}>
        <div className="mb-head lg:col-span-7">
          <h2
            id="receipt-details-title"
            className="text-heading font-extrabold text-balance break-keep"
          >
            {t("title")}
          </h2>
          <p className="mt-4 max-w-[34em] text-lede text-faded">{t("lede")}</p>
        </div>
        <dl className="lg:col-span-7">
          {rows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-1 gap-x-columns gap-y-1 border-t border-thermal py-3 sm:grid-cols-[14em_minmax(0,1fr)]"
            >
              <dt className="text-faded">{row.label}</dt>
              <dd className="font-semibold tabular-nums [overflow-wrap:anywhere]">
                {"href" in row && row.href ? (
                  <a href={row.href} target="_blank" rel="noreferrer noopener" className={LINK}>
                    {row.value}
                  </a>
                ) : (
                  (row.value ?? "—")
                )}
              </dd>
            </div>
          ))}
        </dl>
        {allocation ? (
          <div className="mt-section lg:col-span-7">
            <h3 className="text-lede font-extrabold">{t("allocation.title")}</h3>
            <p className="mt-2 max-w-[34em] text-faded">{t("allocation.lede")}</p>
            <dl className="mt-6">
              {[
                {
                  key: "edge",
                  label: t("allocation.edge", { rate: percent, turnover: allocation.turnover }),
                  value: allocation.edge
                },
                { key: "liquidity", label: t("allocation.liquidity"), value: allocation.liquidity },
                ...(allocation.rakeback
                  ? [
                      {
                        key: "rakeback",
                        label: t("allocation.rakeback"),
                        value: allocation.rakeback
                      }
                    ]
                  : []),
                ...(allocation.referrers
                  ? [
                      {
                        key: "referrers",
                        label: t("allocation.referrers"),
                        value: allocation.referrers
                      }
                    ]
                  : []),
                { key: "protocol", label: t("allocation.protocol"), value: allocation.protocol }
              ].map((row) => (
                <div
                  key={row.key}
                  className="grid grid-cols-1 gap-x-columns gap-y-1 border-t border-thermal py-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <dt className="text-faded">{row.label}</dt>
                  <dd className="font-semibold tabular-nums sm:text-right">
                    {row.value} {bet.symbol}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>
    </section>
  );
}

const LINK = RECEIPT_LINK;

/** A bet still on its way: ask the server again until the receipt prints. */
function RefreshWhileWaiting() {
  const router = useRouter();
  React.useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), PENDING_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [router]);
  return null;
}
