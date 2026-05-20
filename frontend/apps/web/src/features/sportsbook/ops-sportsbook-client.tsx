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
  MarketInspector,
  PoolPanel,
  RiskRows,
  SectionShell,
  StatusPill,
  TicketInspector,
  type MarketTapeRow
} from "./components";
import {
  formatCounter,
  formatDuration,
  formatLookupError,
  parseLookupId,
  shortHex
} from "./format";
import { SportsbookOperatorPanel } from "./operator-panel";

const RECENT_MARKET_LIMIT = 8;

const CONTROL_LINKS = [
  {
    labelKey: "opsSportsbook.controls.links.goNoGo",
    href: "/ops",
    detail: "docs/ops/sportsbook-phase2-gonogo-2026-05-14.md"
  },
  {
    labelKey: "opsSportsbook.controls.links.frontendAccess",
    href: "/ops",
    detail: "docs/ops/sportsbook-frontend-access.md"
  },
  {
    labelKey: "opsSportsbook.controls.links.providerPolicy",
    href: "/ops",
    detail: "docs/ops/sportsbook-provider-the-odds-api.md"
  }
] as const;

function getSportsPools(release: SSOTRelease) {
  return (release.pools ?? []).filter(
    (pool) => pool.domain.toLowerCase() === "sports" || Boolean(pool.sportsRisk)
  );
}

function isMarketTapeRow(row: MarketTapeRow | undefined): row is MarketTapeRow {
  return row !== undefined;
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

export function OpsSportsbookPageClient() {
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
    queryKey: ["ops", "sportsbook", "runtime-counters", release?.releaseDigest ?? "none"],
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

  const { refetch: refetchRecentMarkets } = useQuery({
    queryKey: [
      "ops",
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
      "ops",
      "sportsbook",
      "market-lookup",
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
      "ops",
      "sportsbook",
      "ticket-lookup",
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
      setMarketInputError(t("opsSportsbook.lookup.marketNumericError"));
      return;
    }
    setMarketInputError(undefined);
    setMarketLookupId(parsed);
  }, [marketInput, t]);

  const submitTicketLookup = React.useCallback(() => {
    const parsed = parseLookupId(ticketInput);
    if (parsed === undefined) {
      setTicketInputError(t("opsSportsbook.lookup.ticketNumericError"));
      return;
    }
    setTicketInputError(undefined);
    setTicketLookupId(parsed);
  }, [ticketInput, t]);

  const refreshSportsbookReads = React.useCallback(() => {
    void Promise.all([refetchRuntimeCounters(), refetchRecentMarkets(), refetchMarketLookup()]);
  }, [refetchMarketLookup, refetchRecentMarkets, refetchRuntimeCounters]);

  if (!release) {
    return (
      <PageTransition pageKey="ops-sportsbook">
        <div className="mx-auto max-w-3xl py-16">
          <SectionShell
            eyebrow={t("opsSportsbook.eyebrow")}
            title={t("opsSportsbook.noRelease.title")}
            description={readOnlyReason ?? t("opsSportsbook.noRelease.description")}
          >
            <StatusPill tone="warn">{t("opsSportsbook.noRelease.status")}</StatusPill>
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
  const riskSummary = sports
    ? {
        maxStake: sports.maxStake,
        maxPayout: sports.maxPayout,
        maxMarketReserved: sports.maxMarketReserved,
        maxOutcomeReserved: sports.maxOutcomeReserved,
        maxEventReserved: sports.maxEventReserved
      }
    : undefined;

  return (
    <PageTransition pageKey="ops-sportsbook">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-8 py-10 md:py-14">
        <header className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px] md:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-fg-subtle">
              <Link href="/ops" className="hover:text-fg">
                {t("nav.ops")}
              </Link>
              <span>/</span>
              <span className="text-fg">{t("opsSportsbook.eyebrow")}</span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-fg md:text-4xl">
              {t("opsSportsbook.title")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-fg-muted">
              {t("opsSportsbook.description")}
            </p>
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-1 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={statusTone}>
                {sportsbook.enabled
                  ? t("opsSportsbook.flags.enabled")
                  : t("opsSportsbook.flags.readonly")}
              </StatusPill>
              <StatusPill tone={sportsbook.hasSportsRelease ? "success" : "warn"}>
                {sportsbook.hasSportsRelease
                  ? t("opsSportsbook.flags.present")
                  : t("opsSportsbook.flags.missing")}
              </StatusPill>
            </div>
            <div className="text-xs leading-5 text-fg-muted">
              {sportsbook.disabledReason ?? t("opsSportsbook.flags.notes")}
            </div>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          <DetailCell
            label={t("opsSportsbook.counters.nextMarket")}
            value={formatCounter(runtimeCounters?.nextMarketId)}
            helper={runtimeError ? t("opsSportsbook.counters.runtimeReadFailed") : undefined}
          />
          <DetailCell
            label={t("opsSportsbook.counters.nextTicket")}
            value={formatCounter(runtimeCounters?.nextTicketId)}
            helper={runtimeError ? t("opsSportsbook.counters.runtimeReadFailed") : undefined}
          />
          <DetailCell
            label={t("opsSportsbook.counters.challengeWindow")}
            value={formatDuration(sports?.resultChallengeTimeoutSeconds)}
            helper={t("opsSportsbook.counters.challengeWindowHelper")}
          />
        </div>

        <SectionShell
          eyebrow={t("opsSportsbook.release.eyebrow")}
          title={t("opsSportsbook.release.title")}
          description={t("opsSportsbook.release.description")}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <DetailCell
              label={t("opsSportsbook.release.releaseField")}
              value={shortHex(release.releaseDigest)}
              helper={release.name}
            />
            <DetailCell label={t("opsSportsbook.release.sportsHub")} value={shortHex(sportsHub)} />
            <DetailCell
              label={t("opsSportsbook.release.riskEngine")}
              value={shortHex(riskEngine)}
            />
            <DetailCell
              label={t("opsSportsbook.release.oddsSignerSet")}
              value={shortHex(sports?.oddsSignerSetHash)}
            />
            <DetailCell
              label={t("opsSportsbook.release.resultReporterSet")}
              value={shortHex(sports?.resultReporterSetHash)}
            />
            <DetailCell
              label={t("opsSportsbook.release.frontendFlag")}
              value={
                sportsbook.frontendEnabled
                  ? t("opsSportsbook.release.booleanTrue")
                  : t("opsSportsbook.release.booleanFalse")
              }
              helper={sportsbook.enablementFlag}
              mono={false}
            />
          </div>
        </SectionShell>

        {riskSummary ? (
          <SectionShell
            eyebrow={t("opsSportsbook.caps.eyebrow")}
            title={t("opsSportsbook.caps.title")}
            description={t("opsSportsbook.caps.description")}
          >
            <RiskRows title={t("opsSportsbook.caps.riskTitle")} risk={riskSummary} />
          </SectionShell>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-2">
          <SectionShell
            eyebrow={t("opsSportsbook.lookup.marketEyebrow")}
            title={t("opsSportsbook.lookup.marketTitle")}
            description={t("opsSportsbook.lookup.marketDescription")}
          >
            <div className="grid gap-4">
              <LookupForm
                id="ops-sports-market-id"
                label={t("opsSportsbook.lookup.marketLabel")}
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
                  {t("opsSportsbook.lookup.marketEmpty")}
                </div>
              )}
            </div>
          </SectionShell>

          <SectionShell
            eyebrow={t("opsSportsbook.lookup.ticketEyebrow")}
            title={t("opsSportsbook.lookup.ticketTitle")}
            description={t("opsSportsbook.lookup.ticketDescription")}
          >
            <div className="grid gap-4">
              <LookupForm
                id="ops-sports-ticket-id"
                label={t("opsSportsbook.lookup.ticketLabel")}
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
                  {t("opsSportsbook.lookup.ticketEmpty")}
                </div>
              )}
            </div>
          </SectionShell>
        </div>

        <SectionShell
          eyebrow={t("opsSportsbook.operator.eyebrow")}
          title={t("opsSportsbook.operator.title")}
          description={t("opsSportsbook.operator.description")}
        >
          <SportsbookOperatorPanel
            sdk={sdk}
            disabled={readOnly || !ready || !sportsbook.hasSportsRelease}
            disabledReason={
              readOnly
                ? readOnlyReason
                : sportsbook.hasSportsRelease
                  ? t("opsSportsbook.operator.walletRoleRequired")
                  : sportsbook.disabledReason
            }
            defaultPoolId={sportsPools[0]?.poolId}
            defaultFinalitySeconds={sports?.resultChallengeTimeoutSeconds}
            onMutated={refreshSportsbookReads}
          />
        </SectionShell>

        <SectionShell
          eyebrow={t("opsSportsbook.bankroll.eyebrow")}
          title={t("opsSportsbook.bankroll.title")}
          description={t("opsSportsbook.bankroll.description")}
        >
          {sportsPools.length ? (
            <div className="grid gap-4">
              {sportsPools.map((pool) => (
                <PoolPanel key={pool.poolId} pool={pool} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-warn/25 bg-warn-soft p-4 text-sm leading-6 text-warn">
              {t("opsSportsbook.bankroll.noPool")}
            </div>
          )}
        </SectionShell>

        <SectionShell
          eyebrow={t("opsSportsbook.controls.eyebrow")}
          title={t("opsSportsbook.controls.title")}
          description={t("opsSportsbook.controls.description")}
        >
          <div className="grid gap-3 md:grid-cols-3">
            {CONTROL_LINKS.map((link) => (
              <Link
                key={link.detail}
                href={link.href}
                className="rounded-lg border border-border bg-surface-2/50 p-4 transition-colors hover:border-brand/30 hover:bg-surface-3"
              >
                <div className="text-sm font-semibold text-fg">{t(link.labelKey)}</div>
                <div className="mt-2 break-all font-mono text-xs leading-5 text-fg-muted">
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
