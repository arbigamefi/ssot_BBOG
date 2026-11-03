"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import type { CasinoAccess } from "../../app-shell/casino-access";
import { OFFICIAL_CHANNELS, TESTNET_USDC_FAUCET } from "../../config/site";
import { PrintedFigure } from "./printed-figure";
import type { SignedAmount } from "./receipts";

/** Every section sits on one 12-column grid inside the page width. */
const SECTION_GRID =
  "mx-auto box-content grid max-w-page grid-cols-1 gap-x-grid px-gutter lg:grid-cols-12";
const HEADING = "text-heading font-extrabold text-balance break-keep";
const FOCUS_ON_PAPER =
  "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink";
const FOCUS_ON_CARBON =
  "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-paper";
const LINK = "font-semibold underline decoration-1 underline-offset-4";
/** The one filled button on carbon is paper; ink never sits on carbon. */
const PAPER_BUTTON = `inline-grid min-h-12 place-items-center rounded-print bg-paper px-5 font-semibold whitespace-nowrap text-ink hover:bg-on-carbon-muted ${FOCUS_ON_CARBON}`;
const OUTLINE_ON_CARBON = `inline-grid min-h-12 place-items-center rounded-sheet border border-current px-5 font-semibold whitespace-nowrap text-paper hover:bg-paper hover:text-ink ${FOCUS_ON_CARBON}`;

export const FOLLOW_ID = "home-follow";

function SectionHead({ id, title, lede }: { id: string; title: string; lede?: string }) {
  return (
    <div className="mb-head lg:col-span-7">
      <h2 id={id} className={HEADING}>
        {title}
      </h2>
      {lede ? <p className="mt-4 max-w-[34em] text-lede text-faded">{lede}</p> : null}
    </div>
  );
}

export function HomeHero({
  access,
  chainName,
  printer
}: {
  access: CasinoAccess;
  chainName: string;
  printer: React.ReactNode;
}) {
  const t = useTranslations("home.hero");
  return (
    <header className="bg-carbon text-paper">
      <div className="mx-auto box-content grid max-w-page grid-cols-1 gap-x-grid px-gutter pt-24 pb-section md:pt-32 lg:grid-cols-12 lg:grid-rows-[1fr_auto_auto_1fr]">
        <div className="lg:col-span-6 lg:col-start-1 lg:row-start-2">
          <h1 className="text-display font-extrabold text-balance break-keep">{t("title")}</h1>
          <p className="mt-6 max-w-[32em] text-lede text-on-carbon-muted">{t("lede")}</p>
        </div>
        <div className="mt-8 w-full max-w-[440px] lg:col-span-5 lg:col-start-8 lg:row-span-full lg:mt-0 lg:justify-self-end">
          {printer}
        </div>
        <div className="pt-8 lg:col-span-6 lg:col-start-1 lg:row-start-3 lg:pt-12">
          <HeroAction access={access} chainName={chainName} />
        </div>
      </div>
    </header>
  );
}

function HeroAction({ access, chainName }: { access: CasinoAccess; chainName: string }) {
  const t = useTranslations("home.hero");
  if (access === "preview") {
    return (
      <div id={FOLLOW_ID} className="max-w-[520px]">
        <p className="mb-3 font-semibold">{t("preview.note")}</p>
        {/* One link: the paper strip carries the ink button as the page's main action. */}
        <a
          href={OFFICIAL_CHANNELS.telegram}
          target="_blank"
          rel="noreferrer noopener"
          className={`group flex flex-wrap gap-1 rounded-sheet bg-paper p-1 ${FOCUS_ON_CARBON}`}
        >
          <span className="flex min-h-12 flex-[1000_1_auto] items-center px-4 text-carbon">
            {t("preview.channel")}
            <b className="ml-[0.3em] font-semibold">@arbigamefi</b>
          </span>
          <span className="grid min-h-12 flex-[1_0_auto] place-items-center rounded-print bg-ink px-5 font-semibold whitespace-nowrap text-paper group-hover:bg-ink-bright">
            {t("preview.join")}
          </span>
        </a>
        <p className="mt-3 text-note text-on-carbon-muted">
          {t.rich("preview.fine", {
            x: (chunks) => (
              <a
                href={OFFICIAL_CHANNELS.x}
                target="_blank"
                rel="noreferrer noopener"
                className={`${LINK} text-paper ${FOCUS_ON_CARBON}`}
              >
                {chunks}
              </a>
            )
          })}
        </p>
        <a href="#home-games" className={`mt-8 inline-block ${LINK} ${FOCUS_ON_CARBON}`}>
          {t("browse")}
        </a>
      </div>
    );
  }
  return (
    <div className="max-w-[520px]">
      {access === "testnet" ? (
        <p className="mb-4 text-on-carbon-muted">{t("testnet.note", { chain: chainName })}</p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Link href="/casino" className={PAPER_BUTTON}>
          {access === "testnet" ? t("testnet.play") : t("live.play")}
        </Link>
        {access === "testnet" ? (
          <a
            href={TESTNET_USDC_FAUCET}
            target="_blank"
            rel="noreferrer noopener"
            className={OUTLINE_ON_CARBON}
          >
            {t("testnet.faucet")}
          </a>
        ) : null}
      </div>
    </div>
  );
}

export type VerifyLinks = {
  // Explorer links; null when the chain has no explorer.
  results?: string | null;
  rules?: string | null;
  houseEdge?: string | null;
  changes?: string | null;
};

export function VerifyLedger({
  links,
  houseEdgeRate
}: {
  links: VerifyLinks;
  houseEdgeRate: string;
}) {
  const t = useTranslations("home.verify");
  const rows: Array<{
    key: "results" | "rules" | "houseEdge" | "changes" | "status" | "audit";
    href?: string | null;
    internal?: boolean;
  }> = [
    { key: "results", href: links.results },
    { key: "rules", href: links.rules },
    { key: "houseEdge", href: links.houseEdge },
    { key: "changes", href: links.changes },
    { key: "status", href: "/status", internal: true },
    { key: "audit" }
  ];
  return (
    <section aria-labelledby="home-verify-title" className="bg-paper py-section text-carbon">
      <div className={SECTION_GRID}>
        <SectionHead id="home-verify-title" title={t("title")} lede={t("lede")} />
        <ul className="border-b border-thermal lg:col-span-12">
          {rows.map((row) => (
            <li
              key={row.key}
              className="grid grid-cols-1 items-baseline gap-x-grid gap-y-1 border-t border-thermal py-6 lg:grid-cols-12"
            >
              <h3 className="text-lede font-semibold lg:col-span-4">{t(`${row.key}.title`)}</h3>
              <p className="text-faded lg:col-span-5">
                {t(`${row.key}.detail`, { rate: houseEdgeRate })}
              </p>
              {row.key === "audit" ? (
                <span className="text-faded lg:col-span-3 lg:justify-self-end">
                  {t("audit.pending")}
                </span>
              ) : row.href ? (
                row.internal ? (
                  <Link
                    href={row.href}
                    className={`text-ink lg:col-span-3 lg:justify-self-end ${LINK} ${FOCUS_ON_PAPER}`}
                  >
                    {t(`${row.key}.action`)}
                  </Link>
                ) : (
                  <a
                    href={row.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`text-ink lg:col-span-3 lg:justify-self-end ${LINK} ${FOCUS_ON_PAPER}`}
                  >
                    {t(`${row.key}.action`)}
                  </a>
                )
              ) : (
                <span className="text-faded lg:col-span-3 lg:justify-self-end">—</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export type TicketStub = {
  key: string;
  href: string;
  multiplier: SignedAmount;
  fixed: boolean;
};

export function GameStubs({
  stubs,
  houseEdgeRate,
  maxRounds
}: {
  stubs: readonly TicketStub[];
  houseEdgeRate: string;
  maxRounds?: number;
}) {
  const t = useTranslations("home.games");
  return (
    <section
      id="home-games"
      aria-labelledby="home-games-title"
      className="scroll-mt-24 bg-paper pb-section text-carbon"
    >
      <div className={SECTION_GRID}>
        <SectionHead
          id="home-games-title"
          title={t("title")}
          lede={t("lede", { rate: houseEdgeRate })}
        />
        <ul className="grid grid-cols-1 gap-grid lg:col-span-12 lg:grid-cols-2">
          {stubs.map((stub) => (
            <li key={stub.key}>
              <Link
                href={stub.href}
                className="group grid min-h-26 grid-cols-[minmax(0,1fr)_128px] rounded-sheet border border-(--stub-edge) text-ink [--stub-edge:hsl(var(--thermal))] hover:[--stub-edge:hsl(var(--ink))] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink md:min-h-28 md:grid-cols-[minmax(0,1fr)_152px]"
              >
                <span className="flex flex-col justify-center gap-1 px-5 py-4 md:px-6 md:py-5">
                  <span className="text-lede font-semibold decoration-1 underline-offset-4 group-hover:underline">
                    {t(`items.${stub.key}.name`)}
                  </span>
                  <span className="text-note text-faded">{t(`items.${stub.key}.desc`)}</span>
                </span>
                <span className="print-perforation flex flex-col items-center justify-center gap-1">
                  <small className="text-note leading-tight text-faded">
                    {stub.fixed ? t("pays") : t("upTo")}
                  </small>
                  <PrintedFigure value={stub.multiplier} suffix="×" className="text-price" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {maxRounds ? (
          <p className="mt-6 text-note text-faded lg:col-span-8">
            {t("note", { rounds: maxRounds })}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function BetSteps({ refundWait }: { refundWait?: string }) {
  const t = useTranslations("home.steps");
  return (
    <section aria-labelledby="home-steps-title" className="bg-paper pb-section text-carbon">
      <div className={SECTION_GRID}>
        <SectionHead id="home-steps-title" title={t("title")} />
        <ol className="grid grid-cols-1 gap-x-grid gap-y-8 lg:col-span-12 lg:grid-cols-3">
          {([0, 1, 2] as const).map((index) => (
            <li key={index} className="border-t border-thermal pt-6">
              <span
                aria-hidden="true"
                className="mb-4 grid size-10 place-items-center rounded-full border-2 border-ink leading-none font-extrabold text-ink"
              >
                {index + 1}
              </span>
              <h3 className="mb-2 text-lede font-semibold">{t(`items.${index}.title`)}</h3>
              <p className="text-faded">{t(`items.${index}.detail`)}</p>
            </li>
          ))}
        </ol>
        {refundWait ? (
          <p className="mt-12 border-t border-thermal pt-6 text-faded lg:col-span-8">
            {t.rich("late", {
              wait: refundWait,
              lead: (chunks) => <b className="font-semibold text-carbon">{chunks}</b>
            })}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export type PoolFigures = {
  symbol: string;
  pool?: SignedAmount;
  free?: SignedAmount;
  turnover?: SignedAmount;
};

export function LiquiditySection({ figures }: { figures: readonly PoolFigures[] }) {
  const t = useTranslations("home.liquidity");
  return (
    <section aria-labelledby="home-liquidity-title" className="bg-carbon py-section text-paper">
      <div className={SECTION_GRID}>
        <div className="mb-head lg:col-span-7">
          <h2 id="home-liquidity-title" className={HEADING}>
            {t("title")}
          </h2>
          <p className="mt-4 max-w-[34em] text-lede text-on-carbon-muted">{t("lede")}</p>
        </div>
        <dl className="grid grid-cols-1 gap-x-grid gap-y-8 lg:col-span-12 lg:grid-cols-3">
          {(["earn", "lose", "leave"] as const).map((key) => (
            <div key={key} className="border-t border-rule-carbon pt-6">
              <dt className="mb-2 text-lede font-semibold">{t(`${key}.title`)}</dt>
              <dd className="text-on-carbon-muted">{t(`${key}.detail`)}</dd>
            </div>
          ))}
        </dl>
        {figures.map((asset) => (
          <dl
            key={asset.symbol}
            aria-label={t("figures.label", { symbol: asset.symbol })}
            className="mt-12 grid grid-cols-1 gap-x-grid gap-y-6 sm:grid-cols-3 lg:col-span-12"
          >
            {(["pool", "free", "turnover"] as const).map((key) => (
              <div key={key}>
                <dt className="text-note text-on-carbon-muted">{t(`figures.${key}`)}</dt>
                <dd className="mt-2 text-price">
                  {asset[key] ? (
                    <>
                      <PrintedFigure value={asset[key]} />
                      <small className="ml-2 text-note font-semibold">{asset.symbol}</small>
                    </>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ))}
        <Link
          href="/earn"
          className={`mt-12 justify-self-start lg:col-span-12 ${LINK} ${FOCUS_ON_CARBON}`}
        >
          {t("more")}
        </Link>
      </div>
    </section>
  );
}

/**
 * On phones the Telegram link rides along the bottom while the follow strip and the
 * footer are out of view. Without a follow strip on the page it never shows.
 */
export function TelegramDock() {
  const t = useTranslations("home.hero.preview");
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    const follow = document.getElementById(FOLLOW_ID);
    if (!follow || typeof IntersectionObserver === "undefined") return;
    const narrow = window.matchMedia("(max-width: 63.99rem)");
    const seen = new Set<Element>();
    const update = () => setShow(narrow.matches && seen.size === 0);
    const watch = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) seen.add(entry.target);
          else seen.delete(entry.target);
        }
        update();
      },
      { rootMargin: "0px 0px -80px 0px" }
    );
    watch.observe(follow);
    document.querySelectorAll("footer").forEach((footer) => watch.observe(footer));
    narrow.addEventListener("change", update);
    return () => {
      watch.disconnect();
      narrow.removeEventListener("change", update);
    };
  }, []);

  return (
    <div
      aria-hidden={!show}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-thermal bg-paper px-gutter pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] motion-safe:transition-[translate,visibility] motion-safe:duration-200 motion-safe:ease-out lg:hidden ${
        show ? "visible translate-y-0" : "invisible translate-y-full"
      }`}
    >
      <a
        href={OFFICIAL_CHANNELS.telegram}
        target="_blank"
        rel="noreferrer noopener"
        tabIndex={show ? undefined : -1}
        className={`grid min-h-12 place-items-center rounded-print bg-ink px-5 font-semibold text-paper hover:bg-ink-bright ${FOCUS_ON_PAPER}`}
      >
        {t("dock")}
      </a>
    </div>
  );
}
