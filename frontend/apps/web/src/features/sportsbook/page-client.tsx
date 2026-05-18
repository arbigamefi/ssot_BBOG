"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import type { SSOTRelease } from "@ssot/ssot/release";

import { PageTransition } from "../../components/PageTransition";
import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../ssot/sdk";
import {
  DetailCell,
  LookupForm,
  MarketTape,
  type MarketTapeRow,
  MarketInspector,
  PoolPanel,
  RiskRows,
  SectionShell,
  StatusPill,
  TicketInspector
} from "./components";
import {
  formatCounter,
  formatDuration,
  formatLookupError,
  parseLookupId,
  shortHex
} from "./format";
import { SportsbookOperatorPanel } from "./operator-panel";

const CONTROL_LINKS = [
  {
    labelKey: "sportsbook.index.controls.links.goNoGo",
    href: "/ops",
    detail: "docs/ops/sportsbook-phase2-gonogo-2026-05-14.md"
  },
  {
    labelKey: "sportsbook.index.controls.links.frontendAccess",
    href: "/ops",
    detail: "docs/ops/sportsbook-frontend-access.md"
  },
  {
    labelKey: "sportsbook.index.controls.links.providerPolicy",
    href: "/ops",
    detail: "docs/ops/sportsbook-provider-the-odds-api.md"
  }
] as const;

const RECENT_MARKET_LIMIT = 8;

function getSportsPools(release: SSOTRelease) {
  return (release.pools ?? []).filter(
    (pool) => pool.domain.toLowerCase() === "sports" || Boolean(pool.sportsRisk)
  );
}

function getRecentMarketIds(nextMarketId: bigint, limit: number) {
  if (nextMarketId <= 1n || limit <= 0) return [];
  const ids: bigint[] = [];
  let current = nextMarketId - 1n;
  while (current >= 1n && ids.length < limit) {
    ids.push(current);
    current -= 1n;
  }
  return ids;
}

function isMarketTapeRow(row: MarketTapeRow | undefined): row is MarketTapeRow {
  return row !== undefined;
}

export function SportsbookPageClient() {
  const t = useTranslations();
  const { release, readOnly, readOnlyReason, sportsbook } = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const [marketInput, setMarketInput] = React.useState("");
  const [ticketInput, setTicketInput] = React.useState("");
  const [marketLookupId, setMarketLookupId] = React.useState<bigint | undefined>();
  const [ticketLookupId, setTicketLookupId] = React.useState<bigint | undefined>();
  const [marketInputError, setMarketInputError] = React.useState<string | undefined>();
  const [ticketInputError, setTicketInputError] = React.useState<string | undefined>();
  const {
    data: runtimeCounters,
    error: runtimeError,
    refetch: refetchRuntimeCounters
  } = useQuery({
    queryKey: ["ssot", "sportsbook", "runtime-counters", release?.releaseDigest ?? "none"],
    enabled: Boolean(release && sdk && ready && sportsbook.hasSportsRelease),
    staleTime: 15_000,
    queryFn: async () => {
      if (!release || !sdk) return undefined;
      const [nextMarketId, nextTicketId] = await Promise.all([
        sdk.sportsHub.getNextMarketId(),
        sdk.sportsHub.getNextTicketId()
      ]);
      return { nextMarketId, nextTicketId };
    }
  });
  const {
    data: recentMarkets,
    error: recentMarketsError,
    isFetching: recentMarketsFetching,
    refetch: refetchRecentMarkets
  } = useQuery({
    queryKey: [
      "ssot",
      "sportsbook",
      "recent-markets",
      release?.releaseDigest ?? "none",
      runtimeCounters?.nextMarketId?.toString() ?? "none"
    ],
    enabled: Boolean(
      release &&
      sdk &&
      ready &&
      sportsbook.hasSportsRelease &&
      runtimeCounters?.nextMarketId &&
      runtimeCounters.nextMarketId > 1n
    ),
    staleTime: 15_000,
    queryFn: async () => {
      if (!sdk || !runtimeCounters?.nextMarketId) return [];
      const marketIds = getRecentMarketIds(runtimeCounters.nextMarketId, RECENT_MARKET_LIMIT);
      const rows = await Promise.all(
        marketIds.map(async (marketId): Promise<MarketTapeRow | undefined> => {
          try {
            const market = await sdk.sportsHub.getMarket(marketId);
            const [result, reserved] = await Promise.all([
              sdk.sportsHub.getResult(marketId).catch(() => undefined),
              sdk.sportsHub.getMarketReserved(marketId).catch(() => undefined)
            ]);
            return { market, result, reserved };
          } catch {
            return undefined;
          }
        })
      );
      return rows.filter(isMarketTapeRow);
    }
  });
  const {
    data: marketLookup,
    error: marketLookupError,
    isFetching: marketFetching,
    refetch: refetchMarketLookup
  } = useQuery({
    queryKey: [
      "ssot",
      "sportsbook",
      "market",
      release?.releaseDigest ?? "none",
      marketLookupId?.toString() ?? "none"
    ],
    enabled: Boolean(release && sdk && ready && marketLookupId !== undefined),
    staleTime: 15_000,
    queryFn: async () => {
      if (!sdk || marketLookupId === undefined) return undefined;
      const [market, result, reserved] = await Promise.all([
        sdk.sportsHub.getMarket(marketLookupId),
        sdk.sportsHub.getResult(marketLookupId).catch(() => undefined),
        sdk.sportsHub.getMarketReserved(marketLookupId)
      ]);
      return { market, result, reserved };
    }
  });
  const {
    data: ticketLookup,
    error: ticketLookupError,
    isFetching: ticketFetching
  } = useQuery({
    queryKey: [
      "ssot",
      "sportsbook",
      "ticket",
      release?.releaseDigest ?? "none",
      ticketLookupId?.toString() ?? "none"
    ],
    enabled: Boolean(release && sdk && ready && ticketLookupId !== undefined),
    staleTime: 15_000,
    queryFn: async () => {
      if (!sdk || ticketLookupId === undefined) return undefined;
      return await sdk.sportsHub.getTicket(ticketLookupId);
    }
  });

  const submitMarketLookup = React.useCallback(() => {
    const parsed = parseLookupId(marketInput);
    if (parsed === undefined) {
      setMarketInputError(t("sportsbook.index.lookup.marketNumericError"));
      return;
    }
    setMarketInputError(undefined);
    setMarketLookupId(parsed);
  }, [marketInput, t]);

  const submitTicketLookup = React.useCallback(() => {
    const parsed = parseLookupId(ticketInput);
    if (parsed === undefined) {
      setTicketInputError(t("sportsbook.index.lookup.ticketNumericError"));
      return;
    }
    setTicketInputError(undefined);
    setTicketLookupId(parsed);
  }, [ticketInput, t]);

  const inspectRecentMarket = React.useCallback((marketId: bigint) => {
    setMarketInput(marketId.toString());
    setMarketInputError(undefined);
    setMarketLookupId(marketId);
  }, []);

  const refreshSportsbookReads = React.useCallback(() => {
    void Promise.all([refetchRuntimeCounters(), refetchRecentMarkets(), refetchMarketLookup()]);
  }, [refetchMarketLookup, refetchRecentMarkets, refetchRuntimeCounters]);

  if (!release) {
    return (
      <PageTransition pageKey="sportsbook">
        <div className="mx-auto max-w-3xl py-16">
          <SectionShell
            eyebrow={t("nav.sportsbook")}
            title={t("sportsbook.index.noRelease.title")}
            description={readOnlyReason ?? t("sportsbook.index.noRelease.description")}
          >
            <StatusPill tone="warn">{t("sportsbook.index.noRelease.status")}</StatusPill>
          </SectionShell>
        </div>
      </PageTransition>
    );
  }

  const sports = release.sports;
  const sportsHub = sports?.sportsHub ?? release.contracts.sportsHub;
  const riskEngine = sports?.riskEngine ?? release.contracts.sportsRiskEngine;
  const sportsPools = getSportsPools(release);
  const statusTone = sportsbook.enabled ? "success" : "warn";
  const marketTapeLoading = Boolean(
    sdk &&
    ready &&
    sportsbook.hasSportsRelease &&
    !runtimeError &&
    (!runtimeCounters || (recentMarketsFetching && !recentMarkets))
  );
  const riskSummary = sports
    ? {
        maxStake: sports.maxStake,
        maxPayout: sports.maxPayout,
        maxMarketReserved: sports.maxMarketReserved,
        maxOutcomeReserved: sports.maxOutcomeReserved,
        maxEventReserved: sports.maxEventReserved
      }
    : undefined;
  const latestMarketHref = recentMarkets?.[0]?.market
    ? `/sportsbook/${recentMarkets[0].market.marketId.toString()}`
    : "/sportsbook";

  return (
    <PageTransition pageKey="sportsbook">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 py-10 md:gap-8 md:py-14">
        <header className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-stretch">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill tone={statusTone}>
                {sportsbook.enabled
                  ? t("sportsbook.index.header.metadataEnabled")
                  : t("sportsbook.index.header.readOnlyPreview")}
              </StatusPill>
              <StatusPill tone={sportsbook.hasSportsRelease ? "success" : "warn"}>
                {sportsbook.hasSportsRelease
                  ? t("sportsbook.index.header.sportsHubPresent")
                  : t("sportsbook.index.header.sportsHubMissing")}
              </StatusPill>
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-fg md:text-5xl">
              {t("sportsbook.index.header.title")}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-fg-muted md:text-[15px]">
              {t("sportsbook.index.header.description")}
            </p>
          </div>

          <div className="flex flex-col justify-between rounded-lg border border-border bg-surface-1/70 p-5 shadow-e2">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-fg-subtle">
              {t("sportsbook.index.riskCard.eyebrow")}
            </div>
            <div className="mt-3 text-2xl font-black text-fg">
              {sportsbook.enabled
                ? t("sportsbook.index.riskCard.signedOddsOnly")
                : t("sportsbook.index.riskCard.locked")}
            </div>
            <p className="mt-2 text-sm leading-6 text-fg-muted">
              {sportsbook.enabled
                ? t("sportsbook.index.riskCard.description")
                : t("sportsbook.index.riskCard.lockedDescription")}
            </p>
            <Link
              href={latestMarketHref}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border bg-surface-2 px-4 text-sm font-semibold text-fg transition-colors hover:border-brand/40 hover:bg-surface-3"
            >
              {t("sportsbook.index.riskCard.inspect")}
            </Link>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          <DetailCell
            label={t("sportsbook.index.details.nextMarket")}
            value={formatCounter(runtimeCounters?.nextMarketId)}
            helper={
              runtimeError
                ? t("sportsbook.index.details.runtimeReadFailed")
                : t("sportsbook.index.details.marketHelper")
            }
          />
          <DetailCell
            label={t("sportsbook.index.details.nextTicket")}
            value={formatCounter(runtimeCounters?.nextTicketId)}
            helper={
              runtimeError
                ? t("sportsbook.index.details.runtimeReadFailed")
                : t("sportsbook.index.details.ticketHelper")
            }
          />
          <DetailCell
            label={t("sportsbook.index.details.challengeWindow")}
            value={formatDuration(sports?.resultChallengeTimeoutSeconds)}
            helper={t("sportsbook.index.details.challengeWindowHelper")}
          />
        </div>

        <SectionShell
          eyebrow={t("sportsbook.index.marketTape.eyebrow")}
          title={t("sportsbook.index.marketTape.title")}
          description={t("sportsbook.index.marketTape.description")}
        >
          <MarketTape
            rows={recentMarkets ?? []}
            loading={marketTapeLoading}
            error={formatLookupError(recentMarketsError ?? runtimeError)}
            onInspect={inspectRecentMarket}
          />
        </SectionShell>

        <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
          <SectionShell
            eyebrow={t("sportsbook.index.mvp.eyebrow")}
            title={t("sportsbook.index.mvp.title")}
            description={t("sportsbook.index.mvp.description")}
          >
            <div className="grid gap-3">
              {[
                [
                  t("sportsbook.index.mvp.rows.marketType.label"),
                  t("sportsbook.index.mvp.rows.marketType.value")
                ],
                [
                  t("sportsbook.index.mvp.rows.oddsSource.label"),
                  t("sportsbook.index.mvp.rows.oddsSource.value")
                ],
                [
                  t("sportsbook.index.mvp.rows.settlement.label"),
                  t("sportsbook.index.mvp.rows.settlement.value")
                ],
                [
                  t("sportsbook.index.mvp.rows.launchState.label"),
                  t("sportsbook.index.mvp.rows.launchState.value")
                ]
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-2/70 px-4 py-3"
                >
                  <div className="text-sm text-fg-muted">{label}</div>
                  <div className="text-right text-sm font-semibold text-fg">{value}</div>
                </div>
              ))}
            </div>
          </SectionShell>

          <SectionShell
            eyebrow={t("sportsbook.index.release.eyebrow")}
            title={t("sportsbook.index.release.title")}
            description={t("sportsbook.index.release.description")}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <DetailCell
                label={t("sportsbook.index.details.release")}
                value={shortHex(release.releaseDigest)}
                helper={release.name}
              />
              <DetailCell
                label={t("sportsbook.index.details.sportsHub")}
                value={shortHex(sportsHub)}
                helper={
                  sportsbook.hasSportsRelease
                    ? t("sportsbook.index.details.embeddedMetadataPresent")
                    : t("sportsbook.index.details.notAvailable")
                }
              />
              <DetailCell
                label={t("sportsbook.index.details.riskEngine")}
                value={shortHex(riskEngine)}
                helper={t("sportsbook.index.details.riskEngineHelper")}
              />
              <DetailCell
                label={t("sportsbook.index.release.oddsSignerSet")}
                value={shortHex(sports?.oddsSignerSetHash)}
              />
              <DetailCell
                label={t("sportsbook.index.release.resultReporterSet")}
                value={shortHex(sports?.resultReporterSetHash)}
              />
              <DetailCell
                label={t("sportsbook.index.release.frontendFlag")}
                value={
                  sportsbook.frontendEnabled
                    ? t("sportsbook.index.release.booleanTrue")
                    : t("sportsbook.index.release.booleanFalse")
                }
                helper={sportsbook.enablementFlag}
                mono={false}
              />
            </div>
          </SectionShell>
        </div>

        {riskSummary ? (
          <SectionShell
            eyebrow={t("sportsbook.index.caps.eyebrow")}
            title={t("sportsbook.index.caps.title")}
            description={t("sportsbook.index.caps.description")}
          >
            <RiskRows title={t("sportsbook.index.caps.riskTitle")} risk={riskSummary} />
          </SectionShell>
        ) : null}

        <SectionShell
          eyebrow={t("sportsbook.index.lookup.eyebrow")}
          title={t("sportsbook.index.lookup.title")}
          description={t("sportsbook.index.lookup.description")}
        >
          <div className="grid gap-5 xl:grid-cols-2">
            <div className="grid gap-4">
              <LookupForm
                id="sports-market-id"
                label={t("sportsbook.index.lookup.marketId")}
                value={marketInput}
                onChange={setMarketInput}
                onSubmit={submitMarketLookup}
                disabled={!sdk || !ready || marketFetching}
                error={marketInputError ?? formatLookupError(marketLookupError)}
              />
              {marketLookup?.market ? (
                <MarketInspector
                  market={marketLookup.market}
                  result={marketLookup.result}
                  reserved={marketLookup.reserved}
                />
              ) : (
                <div className="rounded-lg border border-border bg-surface-2/50 p-4 text-sm leading-6 text-fg-muted">
                  {t("sportsbook.index.lookup.marketEmpty")}
                </div>
              )}
            </div>

            <div className="grid gap-4">
              <LookupForm
                id="sports-ticket-id"
                label={t("sportsbook.index.lookup.ticketId")}
                value={ticketInput}
                onChange={setTicketInput}
                onSubmit={submitTicketLookup}
                disabled={!sdk || !ready || ticketFetching}
                error={ticketInputError ?? formatLookupError(ticketLookupError)}
              />
              {ticketLookup ? (
                <TicketInspector ticket={ticketLookup} />
              ) : (
                <div className="rounded-lg border border-border bg-surface-2/50 p-4 text-sm leading-6 text-fg-muted">
                  {t("sportsbook.index.lookup.ticketEmpty")}
                </div>
              )}
            </div>
          </div>
        </SectionShell>

        <SectionShell
          eyebrow={t("sportsbook.index.operator.eyebrow")}
          title={t("sportsbook.index.operator.title")}
          description={t("sportsbook.index.operator.description")}
        >
          <SportsbookOperatorPanel
            sdk={sdk}
            disabled={readOnly || !ready || !sportsbook.hasSportsRelease}
            disabledReason={
              readOnly
                ? readOnlyReason
                : sportsbook.hasSportsRelease
                  ? t("sportsbook.index.operator.walletRoleRequired")
                  : sportsbook.disabledReason
            }
            defaultPoolId={sportsPools[0]?.poolId}
            defaultFinalitySeconds={sports?.resultChallengeTimeoutSeconds}
            onMutated={refreshSportsbookReads}
          />
        </SectionShell>

        <SectionShell
          eyebrow={t("sportsbook.index.bankroll.eyebrow")}
          title={t("sportsbook.index.bankroll.title")}
          description={t("sportsbook.index.bankroll.description")}
        >
          {sportsPools.length ? (
            <div className="grid gap-5">
              {sportsPools.map((pool) => (
                <PoolPanel key={pool.poolId} pool={pool} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-warn/25 bg-warn-soft p-4 text-sm leading-6 text-warn">
              {t("sportsbook.index.bankroll.noPool")}
            </div>
          )}
        </SectionShell>

        <SectionShell
          eyebrow={t("sportsbook.index.controls.eyebrow")}
          title={t("sportsbook.index.controls.title")}
          description={t("sportsbook.index.controls.description")}
        >
          <div className="grid gap-4 md:grid-cols-3">
            {CONTROL_LINKS.map((link) => (
              <Link
                key={link.detail}
                href={link.href}
                className="rounded-lg border border-border bg-surface-2/70 p-4 transition-colors hover:border-brand/30 hover:bg-surface-3"
              >
                <div className="text-sm font-semibold text-fg">{t(link.labelKey)}</div>
                <div className="mt-3 break-all font-mono text-xs leading-5 text-fg-muted">
                  {link.detail}
                </div>
              </Link>
            ))}
          </div>
        </SectionShell>
      </div>
    </PageTransition>
  );
}
