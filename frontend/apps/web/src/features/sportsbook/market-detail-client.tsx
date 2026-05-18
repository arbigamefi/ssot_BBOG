"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";

import { PageTransition } from "../../components/PageTransition";
import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../ssot/sdk";
import {
  DetailCell,
  MarketInspector,
  SectionShell,
  sportsOutcomeLabel,
  StatusPill,
  type MarketTapeRow
} from "./components";
import { formatLookupError, getLookupErrorKind, parseLookupId, shortHex } from "./format";
import { SportsbookTicketPlacementPanel } from "./ticket-placement-panel";
import { SportsbookTicketTerminalPanel } from "./ticket-terminal-panel";

interface MarketDetailReadback extends MarketTapeRow {
  eventReserved?: bigint;
  poolEventReserved?: bigint;
  outcomeReserved: Array<{ outcomeId: number; reserved?: bigint }>;
}

const SPORTSBOOK_DETAIL_READ_TIMEOUT_MS = 8_000;

function formatUnits(value?: bigint) {
  return value === undefined ? "—" : value.toLocaleString("en-US");
}

function marketStatusTone(state: string): "success" | "warn" | "neutral" {
  if (state === "open") return "success";
  if (state === "suspended" || state === "challenged" || state === "voided") return "warn";
  return "neutral";
}

async function withReadTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("SportsHub read timed out. Check the RPC connection and try again."));
    }, SPORTSBOOK_DETAIL_READ_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function SportsbookMarketDetailPageClient({ marketId }: { marketId: string }) {
  const t = useTranslations();
  const { release, readOnly, readOnlyReason, sportsbook, chainId } = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const parsedMarketId = React.useMemo(() => parseLookupId(marketId), [marketId]);

  const {
    data: readback,
    error,
    isFetching,
    refetch: refetchReadback
  } = useQuery({
    queryKey: [
      "ssot",
      "sportsbook",
      "market-detail",
      release?.releaseDigest ?? "none",
      parsedMarketId?.toString() ?? "invalid"
    ],
    enabled: Boolean(release && sdk && ready && parsedMarketId !== undefined),
    retry: false,
    staleTime: 15_000,
    queryFn: async (): Promise<MarketDetailReadback | undefined> => {
      if (!sdk || parsedMarketId === undefined) return undefined;
      return await withReadTimeout(
        (async () => {
          const market = await sdk.sportsHub.getMarket(parsedMarketId);
          const [result, reserved, eventReserved, poolEventReserved] = await Promise.all([
            sdk.sportsHub.getResult(parsedMarketId).catch(() => undefined),
            sdk.sportsHub.getMarketReserved(parsedMarketId).catch(() => undefined),
            sdk.sportsHub.getEventReserved(market.eventId).catch(() => undefined),
            sdk.sportsHub.getPoolEventReserved(market.poolId, market.eventId).catch(() => undefined)
          ]);
          const outcomeReserved = await Promise.all(
            Array.from({ length: market.outcomeCount }, async (_, outcomeId) => ({
              outcomeId,
              reserved: await sdk.sportsHub
                .getMarketOutcomeReserved(parsedMarketId, outcomeId)
                .catch(() => undefined)
            }))
          );
          return { market, result, reserved, eventReserved, poolEventReserved, outcomeReserved };
        })()
      );
    }
  });

  if (!release) {
    return (
      <PageTransition pageKey={`sports-market-${marketId}`}>
        <div className="mx-auto max-w-3xl py-16">
          <SectionShell
            eyebrow={t("nav.sportsbook")}
            title={t("sportsbook.detail.noRelease.title")}
            description={readOnlyReason ?? t("sportsbook.detail.noRelease.description")}
          >
            <StatusPill tone="warn">{t("sportsbook.detail.noRelease.status")}</StatusPill>
          </SectionShell>
        </div>
      </PageTransition>
    );
  }

  const readbackErrorKind = getLookupErrorKind(error);
  const readbackErrorMessage =
    readbackErrorKind === "marketNotFound"
      ? t("sportsbook.detail.readFailed.marketNotFound")
      : formatLookupError(error);

  return (
    <PageTransition pageKey={`sports-market-${marketId}`}>
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8 py-12 md:py-16">
        <header className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Link
              href="/sportsbook"
              className="text-sm font-semibold text-fg-muted transition-colors hover:text-fg"
            >
              {t("sportsbook.detail.back")}
            </Link>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <StatusPill tone={sportsbook.enabled ? "success" : "warn"}>
                {sportsbook.enabled
                  ? t("sportsbook.index.header.metadataEnabled")
                  : t("sportsbook.index.header.readOnlyPreview")}
              </StatusPill>
              <StatusPill tone="neutral">{t("sportsbook.detail.marketDetailPill")}</StatusPill>
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-fg md:text-5xl">
              {t("sportsbook.detail.title", { marketId })}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-fg-muted md:text-[15px]">
              {t("sportsbook.detail.description")}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface-1/70 p-5 shadow-e2">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-fg-subtle">
              SportsHub
            </div>
            <div className="mt-3 font-mono text-sm font-semibold text-fg">
              {shortHex(release.sports?.sportsHub ?? release.contracts.sportsHub)}
            </div>
          </div>
        </header>

        {parsedMarketId === undefined ? (
          <SectionShell
            eyebrow={t("sportsbook.detail.invalid.eyebrow")}
            title={t("sportsbook.detail.invalid.title")}
            description={t("sportsbook.detail.invalid.description")}
          >
            <Link
              href="/sportsbook"
              className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-black text-fg-inverse shadow-glow transition-colors hover:bg-brand-hover"
            >
              {t("sportsbook.detail.return")}
            </Link>
          </SectionShell>
        ) : error ? (
          <SectionShell
            eyebrow={t("sportsbook.detail.readFailed.eyebrow")}
            title={t("sportsbook.detail.readFailed.title")}
            description={t("sportsbook.detail.readFailed.description")}
          >
            <div className="rounded-lg border border-danger/25 bg-danger-soft p-4 text-sm leading-6 text-danger">
              {readbackErrorMessage}
            </div>
          </SectionShell>
        ) : isFetching && !readback ? (
          <SectionShell
            eyebrow={t("sportsbook.detail.loading.eyebrow")}
            title={t("sportsbook.detail.loading.title")}
            description={t("sportsbook.detail.loading.description")}
          >
            <div className="rounded-lg border border-border bg-surface-2/50 p-4 text-sm leading-6 text-fg-muted">
              {t("sportsbook.detail.loading.body")}
            </div>
          </SectionShell>
        ) : readback ? (
          <>
            <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
              <SectionShell
                className="order-2 xl:order-1"
                eyebrow={t("sportsbook.detail.playerMarket.eyebrow")}
                title={t("sportsbook.detail.playerMarket.title")}
                description={t("sportsbook.detail.playerMarket.description")}
              >
                <div className="grid gap-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusPill tone={marketStatusTone(readback.market.state)}>
                      {readback.market.state}
                    </StatusPill>
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-subtle">
                      {t("sportsbook.detail.playerMarket.marketId", {
                        marketId: readback.market.marketId.toString()
                      })}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-subtle">
                      {t("sportsbook.components.marketTape.event", {
                        eventId: readback.market.eventId.toString()
                      })}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {Array.from({ length: readback.market.outcomeCount }, (_, outcomeId) => {
                      const resultReady = Boolean(
                        readback.result && readback.result.proposedAt > 0
                      );
                      const isWinner =
                        resultReady &&
                        Number(readback.result?.winningOutcomeId ?? -1) === outcomeId;
                      return (
                        <div
                          key={outcomeId}
                          className={
                            isWinner
                              ? "rounded-lg border border-success/35 bg-success-soft p-4"
                              : "rounded-lg border border-border bg-surface-2/70 p-4"
                          }
                        >
                          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
                            {t("sportsbook.detail.playerMarket.outcome")}
                          </div>
                          <div
                            className={
                              isWinner
                                ? "mt-2 text-lg font-black text-success"
                                : "mt-2 text-lg font-black text-fg"
                            }
                          >
                            {sportsOutcomeLabel(outcomeId, readback.market.outcomeCount, t)}
                          </div>
                          {isWinner ? (
                            <div className="mt-2 text-xs font-semibold text-success">
                              {t("sportsbook.detail.playerMarket.winner")}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <DetailCell
                      label={t("sportsbook.detail.playerMarket.startsAt")}
                      value={new Date(readback.market.startsAt * 1000).toLocaleString()}
                      mono={false}
                    />
                    <DetailCell
                      label={t("sportsbook.detail.playerMarket.locksAt")}
                      value={new Date(readback.market.lockTime * 1000).toLocaleString()}
                      mono={false}
                    />
                  </div>

                  <div className="rounded-lg border border-border bg-surface-2/50 p-4 text-sm leading-6 text-fg-muted">
                    {readback.result && readback.result.proposedAt > 0
                      ? t("sportsbook.detail.playerMarket.resultReady", {
                          outcome: sportsOutcomeLabel(
                            Number(readback.result.winningOutcomeId),
                            readback.market.outcomeCount,
                            t
                          )
                        })
                      : t("sportsbook.detail.playerMarket.resultPending")}
                  </div>
                </div>
              </SectionShell>

              <SectionShell
                className="order-1 xl:order-2 xl:sticky xl:top-24"
                eyebrow={t("sportsbook.detail.ticketPlacement.eyebrow")}
                title={t("sportsbook.detail.ticketPlacement.title")}
                description={t("sportsbook.detail.ticketPlacement.description")}
              >
                <SportsbookTicketPlacementPanel
                  sdk={sdk}
                  release={release}
                  chainId={chainId}
                  market={readback.market}
                  disabled={
                    readOnly || !ready || !sportsbook.enabled || readback.market.state !== "open"
                  }
                  disabledReason={
                    readOnly
                      ? readOnlyReason
                      : !sportsbook.enabled
                        ? sportsbook.disabledReason
                        : readback.market.state !== "open"
                          ? t("sportsbook.detail.ticketPlacement.marketMustBeOpen")
                          : t("sportsbook.detail.ticketPlacement.walletAndSnapshotRequired")
                  }
                  onMutated={() => void refetchReadback()}
                />
              </SectionShell>
            </div>

            <details className="rounded-lg border border-border bg-surface-1 p-5 shadow-e2">
              <summary className="cursor-pointer text-sm font-black text-fg">
                {t("sportsbook.detail.advanced.summary")}
              </summary>
              <div className="mt-6 grid gap-8">
                <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
                  <SectionShell
                    eyebrow={t("sportsbook.detail.market.eyebrow")}
                    title={t("sportsbook.detail.market.title")}
                    description={t("sportsbook.detail.market.description")}
                  >
                    <MarketInspector
                      market={readback.market}
                      result={readback.result}
                      reserved={readback.reserved}
                    />
                  </SectionShell>

                  <SectionShell
                    eyebrow={t("sportsbook.detail.exposure.eyebrow")}
                    title={t("sportsbook.detail.exposure.title")}
                    description={t("sportsbook.detail.exposure.description")}
                  >
                    <div className="grid gap-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <DetailCell
                          label={t("sportsbook.detail.exposure.marketReserved")}
                          value={formatUnits(readback.reserved)}
                        />
                        <DetailCell
                          label={t("sportsbook.detail.exposure.eventReserved")}
                          value={formatUnits(readback.eventReserved)}
                        />
                        <DetailCell
                          label={t("sportsbook.detail.exposure.poolEventReserved")}
                          value={formatUnits(readback.poolEventReserved)}
                        />
                        <DetailCell
                          label={t("sportsbook.detail.exposure.outcomeCount")}
                          value={readback.market.outcomeCount.toString()}
                        />
                      </div>

                      <div className="overflow-hidden rounded-lg border border-border">
                        <div className="border-b border-border bg-surface-2 px-4 py-3 text-sm font-semibold text-fg">
                          {t("sportsbook.detail.exposure.outcomeExposure")}
                        </div>
                        <div className="divide-y divide-border-soft">
                          {readback.outcomeReserved.map((row) => (
                            <div
                              key={row.outcomeId}
                              className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                            >
                              <div className="text-fg-muted">
                                {t("sportsbook.detail.exposure.outcome", {
                                  outcomeId: String(row.outcomeId)
                                })}
                              </div>
                              <div className="font-mono font-semibold text-fg">
                                {formatUnits(row.reserved)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </SectionShell>
                </div>

                <SectionShell
                  eyebrow={t("sportsbook.detail.ticketTerminal.eyebrow")}
                  title={t("sportsbook.detail.ticketTerminal.title")}
                  description={t("sportsbook.detail.ticketTerminal.description")}
                >
                  <SportsbookTicketTerminalPanel
                    sdk={sdk}
                    disabled={readOnly || !ready}
                    disabledReason={
                      readOnly
                        ? readOnlyReason
                        : t("sportsbook.detail.ticketTerminal.walletRequired")
                    }
                    onMutated={() => void refetchReadback()}
                  />
                </SectionShell>
              </div>
            </details>
          </>
        ) : (
          <SectionShell
            eyebrow={t("sportsbook.detail.noMarket.eyebrow")}
            title={t("sportsbook.detail.noMarket.title")}
            description={t("sportsbook.detail.noMarket.description")}
          >
            <Link
              href="/sportsbook"
              className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-black text-fg-inverse shadow-glow transition-colors hover:bg-brand-hover"
            >
              {t("sportsbook.detail.return")}
            </Link>
          </SectionShell>
        )}
      </div>
    </PageTransition>
  );
}
