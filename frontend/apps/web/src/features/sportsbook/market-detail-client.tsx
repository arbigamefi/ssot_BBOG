"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import type { DomainSportsMarket, DomainSportsResult } from "@ssot/ssot";

import { PageTransition } from "../../components/PageTransition";
import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../ssot/sdk";

import { BetSlip } from "./BetSlip";
import { MarketDetailHeader } from "./MarketDetailHeader";
import { MarketStateBadge } from "./MarketStateBadge";
import { OutcomesBoard } from "./OutcomesBoard";
import { ResultPanel } from "./ResultPanel";
import { describeMarketWallClock, marketShortTag } from "./player-format";
import { providerOutcomeById } from "./provider-odds";
import { useBetSlip } from "./useBetSlip";
import { useSportsbookProviderOdds } from "./use-provider-odds";

const READ_TIMEOUT_MS = 8_000;

async function withReadTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("SportsHub read timed out. Check the RPC connection and try again."));
    }, READ_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

interface MarketReadback {
  market: DomainSportsMarket;
  result?: DomainSportsResult;
  reserved?: bigint;
}

function parseMarketId(input: string): bigint | undefined {
  const normalized = input.trim();
  if (!/^[0-9]+$/.test(normalized)) return undefined;
  try {
    return BigInt(normalized);
  } catch {
    return undefined;
  }
}

function getPoolAsset(
  release: ReturnType<typeof useRelease>["release"],
  poolId: number
): { symbol: string; decimals: number } {
  const pool = release?.pools?.find((p) => Number(p.poolId) === poolId);
  return {
    symbol: pool?.symbol || "UNIT",
    decimals: pool?.decimals ?? 18
  };
}

export function SportsbookMarketDetailPageClient({ marketId }: { marketId: string }) {
  const t = useTranslations("sportsbook.player.detail");
  const locale = useLocale();
  const { release, readOnly, readOnlyReason, sportsbook, chainId } = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const searchParams = useSearchParams();
  const parsedMarketId = React.useMemo(() => parseMarketId(marketId), [marketId]);
  const initialOutcomeId = React.useMemo(() => {
    const raw = searchParams.get("outcome");
    if (!raw || !/^[0-9]+$/.test(raw)) return undefined;
    return Number(raw);
  }, [searchParams]);

  const {
    data: readback,
    error,
    isFetching,
    refetch
  } = useQuery({
    queryKey: [
      "sportsbook",
      "market-detail",
      release?.releaseDigest ?? "none",
      parsedMarketId?.toString() ?? "invalid"
    ],
    enabled: Boolean(release && sdk && ready && parsedMarketId !== undefined),
    retry: false,
    staleTime: 15_000,
    queryFn: async (): Promise<MarketReadback | undefined> => {
      if (!sdk || parsedMarketId === undefined) return undefined;
      return await withReadTimeout(
        (async () => {
          const market = await sdk.sportsHub.getMarket(parsedMarketId);
          const [result, reserved] = await Promise.all([
            sdk.sportsHub.getResult(parsedMarketId).catch(() => undefined),
            sdk.sportsHub.getMarketReserved(parsedMarketId).catch(() => undefined)
          ]);
          return { market, result, reserved };
        })()
      );
    }
  });

  const providerOddsQuery = useSportsbookProviderOdds({
    marketId: readback?.market.marketId,
    enabled: Boolean(readback?.market)
  });
  const providerOdds = providerOddsQuery.data;
  const poolAsset = readback
    ? getPoolAsset(release, readback.market.poolId)
    : { symbol: "UNIT", decimals: 18 };

  // useBetSlip needs a stable market input; pass a fallback skeleton when
  // readback hasn't resolved yet so the hook can keep its identity. The
  // hook is gated by `disabled` until a real market is in place.
  const slip = useBetSlip({
    sdk,
    release,
    chainId,
    market:
      readback?.market ??
      ({
        marketId: parsedMarketId ?? 0n,
        eventId: 0n,
        poolId: 0,
        outcomeCount: 0,
        startsAt: 0,
        lockTime: 0,
        resultFinalitySeconds: 0,
        version: 0n,
        marketKey: "0x" as `0x${string}`,
        rulebookHash: "0x" as `0x${string}`,
        state: "none"
      } as DomainSportsMarket),
    defaultOutcomeId: initialOutcomeId,
    providerOdds,
    walletConnected: Boolean(sdk?.account),
    disabled:
      readOnly ||
      !ready ||
      !sportsbook.enabled ||
      !readback?.market ||
      readback.market.state !== "open",
    disabledReason: readOnly
      ? readOnlyReason
      : !sportsbook.enabled
        ? sportsbook.disabledReason
        : readback?.market && readback.market.state !== "open"
          ? t("slip.marketMustBeOpen")
          : undefined,
    decimals: poolAsset.decimals,
    onPlaced: () => void refetch()
  });

  // ---- Early returns -----------------------------------------------------

  if (!release) {
    return (
      <PageTransition pageKey={`sportsbook-market-${marketId}`}>
        <div className="mx-auto max-w-3xl py-16">
          <NoticeCard
            title={t("noRelease.title")}
            description={readOnlyReason ?? t("noRelease.description")}
          />
        </div>
      </PageTransition>
    );
  }

  if (parsedMarketId === undefined) {
    return (
      <PageTransition pageKey={`sportsbook-market-${marketId}`}>
        <div className="mx-auto max-w-3xl py-16">
          <NoticeCard
            title={t("invalid.title")}
            description={t("invalid.description")}
            cta={{ label: t("invalid.back"), href: "/sportsbook" }}
          />
        </div>
      </PageTransition>
    );
  }

  if (error) {
    return (
      <PageTransition pageKey={`sportsbook-market-${marketId}`}>
        <div className="mx-auto max-w-3xl py-16">
          <NoticeCard
            tone="danger"
            title={t("readFailed.title")}
            description={t("readFailed.description")}
            cta={{ label: t("readFailed.return"), href: "/sportsbook" }}
          />
        </div>
      </PageTransition>
    );
  }

  if (!readback) {
    return (
      <PageTransition pageKey={`sportsbook-market-${marketId}`}>
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6 py-10 md:py-12">
          <HeaderSkeleton />
          <BoardSkeleton />
        </div>
      </PageTransition>
    );
  }

  // ---- Main layout -------------------------------------------------------

  const selectedProviderOutcome =
    slip.selectedOutcomeId !== undefined
      ? providerOutcomeById(providerOdds, slip.selectedOutcomeId)
      : undefined;
  const selectedOutcome =
    slip.selectedOutcomeId !== undefined
      ? {
          label:
            selectedProviderOutcome?.name ??
            t("slip.outcomeFallback", { outcomeId: slip.selectedOutcomeId + 1 }),
          price: selectedProviderOutcome?.decimalPrice
        }
      : undefined;

  const wallClock = describeMarketWallClock(readback.market, Date.now(), locale);
  const stateBadgeLabel = wallClock.kind === "live" ? "LIVE" : readback.market.state;

  return (
    <PageTransition pageKey={`sportsbook-market-${marketId}`}>
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 py-10 md:py-12">
        <MarketDetailHeader market={readback.market} odds={providerOdds} />

        <ResultPanel market={readback.market} result={readback.result} odds={providerOdds} />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
          <div className="flex flex-col gap-4">
            <OutcomesBoard
              market={readback.market}
              odds={providerOdds}
              result={readback.result}
              selectedOutcomeId={slip.selectedOutcomeId}
              onSelect={(outcomeId) => slip.selectOutcome(outcomeId)}
            />

            {providerOddsQuery.error ? (
              <div className="rounded-lg border border-warn/25 bg-warn-soft p-3 text-xs leading-5 text-warn">
                {t("board.providerUnavailable")}
              </div>
            ) : null}

            <MarketMeta
              market={readback.market}
              reserved={readback.reserved}
              tag={marketShortTag(readback.market.marketKey)}
            />

            <ExpertProofDrawer
              marketKey={readback.market.marketKey}
              marketId={readback.market.marketId.toString()}
            />
          </div>

          <BetSlip
            controller={slip}
            symbol={poolAsset.symbol}
            decimals={poolAsset.decimals}
            selectedOutcome={selectedOutcome}
            isReadOnly={readOnly}
            readOnlyReason={readOnlyReason}
            marketStateLabel={stateBadgeLabel}
          />
        </div>

        {isFetching && readback ? (
          <p className="text-center text-xs text-fg-subtle">{t("refreshing")}</p>
        ) : null}
      </div>
    </PageTransition>
  );
}

function MarketMeta({
  market,
  reserved,
  tag
}: {
  market: DomainSportsMarket;
  reserved?: bigint;
  tag: string;
}) {
  const t = useTranslations("sportsbook.player.detail.meta");
  return (
    <section className="rounded-lg border border-border bg-surface-1 p-4 md:p-5">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-fg-subtle">
          {t("title")}
        </h2>
        <span className="font-mono text-[11px] text-fg-subtle">#{tag}</span>
      </header>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-4">
        <Cell label={t("outcomes")} value={market.outcomeCount.toString()} />
        <Cell
          label={t("reserved")}
          value={reserved !== undefined ? reserved.toLocaleString() : "—"}
          mono
        />
        <Cell label={t("version")} value={`v${market.version.toString()}`} mono />
        <Cell
          label={t("state")}
          value={<MarketStateBadge state={market.state} size="small" className="-ml-0.5" />}
        />
      </dl>
    </section>
  );
}

function Cell({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
        {label}
      </dt>
      <dd className={`mt-1 ${mono ? "font-mono tabular-nums" : ""} text-fg`}>{value}</dd>
    </div>
  );
}

function ExpertProofDrawer({ marketKey, marketId }: { marketKey: string; marketId: string }) {
  const t = useTranslations("sportsbook.player.detail.proof");
  return (
    <details className="rounded-lg border border-border bg-surface-1 p-4 md:p-5">
      <summary className="cursor-pointer text-sm font-semibold text-fg">{t("summary")}</summary>
      <div className="mt-3 grid gap-2 text-xs">
        <div className="flex items-center justify-between gap-3 rounded-md border border-border-soft bg-surface-2/60 px-3 py-2">
          <span className="text-fg-subtle">{t("rows.marketKey")}</span>
          <span className="font-mono text-fg">{marketKey}</span>
        </div>
        <Link
          href={`/ops/sportsbook?marketId=${marketId}`}
          className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-surface-2 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
        >
          {t("opsLink")}
        </Link>
      </div>
    </details>
  );
}

function NoticeCard({
  title,
  description,
  tone = "neutral",
  cta
}: {
  title: string;
  description: string;
  tone?: "neutral" | "danger";
  cta?: { label: string; href: string };
}) {
  const tones =
    tone === "danger" ? "border-danger/30 bg-danger-soft" : "border-border bg-surface-1";
  return (
    <div className={`flex flex-col gap-3 rounded-lg border p-6 ${tones}`}>
      <h2 className="text-lg font-semibold text-fg">{title}</h2>
      <p className="text-sm leading-6 text-fg-muted">{description}</p>
      {cta ? (
        <Link
          href={cta.href}
          className="inline-flex h-9 w-fit items-center rounded-md border border-border bg-surface-2 px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-3"
        >
          {cta.label}
        </Link>
      ) : null}
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-4 w-24 animate-pulse rounded bg-surface-2" />
      <div className="h-8 w-64 animate-pulse rounded bg-surface-2" />
      <div className="h-4 w-40 animate-pulse rounded bg-surface-2" />
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="h-48 animate-pulse rounded-lg border border-border bg-surface-1" />
      <div className="h-72 animate-pulse rounded-lg border border-border bg-surface-1" />
    </div>
  );
}
