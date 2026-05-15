"use client";

import * as React from "react";
import Link from "next/link";
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
  TicketInspector
} from "./components";
import {
  formatCounter,
  formatDuration,
  formatLookupError,
  parseLookupId,
  shortHex
} from "./format";

const CONTROL_LINKS = [
  {
    label: "Go/no-go packet",
    href: "/ops",
    detail: "docs/ops/sportsbook-phase2-gonogo-2026-05-14.md"
  },
  {
    label: "Frontend access policy",
    href: "/ops",
    detail: "docs/ops/sportsbook-frontend-access.md"
  },
  {
    label: "Provider policy",
    href: "/ops",
    detail: "docs/ops/sportsbook-provider-the-odds-api.md"
  }
] as const;

function getSportsPools(release: SSOTRelease) {
  return (release.pools ?? []).filter(
    (pool) => pool.domain.toLowerCase() === "sports" || Boolean(pool.sportsRisk)
  );
}

export function SportsbookPageClient() {
  const { release, readOnlyReason, sportsbook } = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const [marketInput, setMarketInput] = React.useState("");
  const [ticketInput, setTicketInput] = React.useState("");
  const [marketLookupId, setMarketLookupId] = React.useState<bigint | undefined>();
  const [ticketLookupId, setTicketLookupId] = React.useState<bigint | undefined>();
  const [marketInputError, setMarketInputError] = React.useState<string | undefined>();
  const [ticketInputError, setTicketInputError] = React.useState<string | undefined>();
  const { data: runtimeCounters, error: runtimeError } = useQuery({
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
    data: marketLookup,
    error: marketLookupError,
    isFetching: marketFetching
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
      setMarketInputError("Enter a numeric market id.");
      return;
    }
    setMarketInputError(undefined);
    setMarketLookupId(parsed);
  }, [marketInput]);

  const submitTicketLookup = React.useCallback(() => {
    const parsed = parseLookupId(ticketInput);
    if (parsed === undefined) {
      setTicketInputError("Enter a numeric ticket id.");
      return;
    }
    setTicketInputError(undefined);
    setTicketLookupId(parsed);
  }, [ticketInput]);

  if (!release) {
    return (
      <PageTransition pageKey="sportsbook">
        <div className="mx-auto max-w-3xl py-16">
          <SectionShell
            eyebrow="Sportsbook"
            title="No release loaded"
            description={readOnlyReason ?? "The embedded release snapshot is unavailable."}
          >
            <StatusPill tone="warn">Unavailable</StatusPill>
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
    <PageTransition pageKey="sportsbook">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8 py-12 md:py-16">
        <header className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill tone={statusTone}>
                {sportsbook.enabled ? "Metadata enabled" : "Read-only preview"}
              </StatusPill>
              <StatusPill tone={sportsbook.hasSportsRelease ? "success" : "warn"}>
                {sportsbook.hasSportsRelease ? "SportsHub present" : "SportsHub missing"}
              </StatusPill>
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-fg md:text-5xl">
              Sportsbook Control Room
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-fg-muted md:text-[15px]">
              Fixed-odds sports markets stay behind explicit launch controls. This entry exposes the
              deployed SportsHub surface and release risk caps without opening public ticket
              placement.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface-1/70 p-5 shadow-e2">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-fg-subtle">
              Public risk-in
            </div>
            <div className="mt-3 text-2xl font-black text-fg">Locked</div>
            <p className="mt-2 text-sm leading-6 text-fg-muted">
              {sportsbook.disabledReason ??
                "Ticket placement remains outside this read-only frontend phase."}
            </p>
            <button
              type="button"
              disabled
              className="mt-5 w-full cursor-not-allowed rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm font-semibold text-fg-subtle opacity-70"
            >
              Ticket placement locked
            </button>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailCell
            label="Release"
            value={shortHex(release.releaseDigest)}
            helper={release.name}
          />
          <DetailCell
            label="SportsHub"
            value={shortHex(sportsHub)}
            helper={sportsbook.hasSportsRelease ? "Embedded metadata present" : "Not available"}
          />
          <DetailCell
            label="Risk engine"
            value={shortHex(riskEngine)}
            helper="Shared cap enforcement surface"
          />
          <DetailCell
            label="Challenge window"
            value={formatDuration(sports?.resultChallengeTimeoutSeconds)}
            helper="Result dispute timeout"
          />
          <DetailCell
            label="Next market"
            value={formatCounter(runtimeCounters?.nextMarketId)}
            helper={runtimeError ? "SportsHub runtime read failed" : "Read through @ssot/ssot SDK"}
          />
          <DetailCell
            label="Next ticket"
            value={formatCounter(runtimeCounters?.nextTicketId)}
            helper={runtimeError ? "SportsHub runtime read failed" : "Read through @ssot/ssot SDK"}
          />
        </div>

        <div className="grid gap-8 xl:grid-cols-[1fr_0.9fr]">
          <SectionShell
            eyebrow="Sports release"
            title="Oracle and settlement surface"
            description="The active bundle exposes signed odds identity, result reporter quorum, and the bootstrap dispute roles needed by SportsHub settlement."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <DetailCell label="Odds signer set" value={shortHex(sports?.oddsSignerSetHash)} />
              <DetailCell
                label="Result reporter set"
                value={shortHex(sports?.resultReporterSetHash)}
              />
              <DetailCell
                label="Reporter threshold"
                value={sports?.resultReporterThreshold ?? "N/A"}
                helper="Minimum result reporters"
              />
              <DetailCell
                label="Frontend flag"
                value={sportsbook.frontendEnabled ? "true" : "false"}
                helper={sportsbook.enablementFlag}
                mono={false}
              />
              <DetailCell label="Challenger" value={shortHex(sports?.resultChallenger)} />
              <DetailCell label="Arbitrator" value={shortHex(sports?.resultArbitrator)} />
            </div>
          </SectionShell>

          <SectionShell
            eyebrow="MVP market"
            title="Football 1X2 readiness"
            description="The current provider path is scoped to pre-match fixed odds, signed snapshots, and explicit result evidence before any public launch decision."
          >
            <div className="grid gap-3">
              {[
                ["Market type", "Pre-match football 1X2"],
                ["Odds source", "The Odds API candidate"],
                ["Settlement", "Reporter result plus challenge window"],
                ["Launch state", "Phase 2 NO-GO for public risk-in"]
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
        </div>

        {riskSummary ? (
          <SectionShell
            eyebrow="Protocol caps"
            title="Top-level SportsHub limits"
            description="These raw-unit caps are copied from the embedded release and should stay aligned with the deployment bundle and ops approval memos."
          >
            <RiskRows title="SportsHub global risk caps" risk={riskSummary} />
          </SectionShell>
        ) : null}

        <SectionShell
          eyebrow="On-chain lookup"
          title="Inspect SportsHub records"
          description="Lookup stays read-only and goes through the v1.3 SDK. Public ticket placement remains locked until the ops gate changes."
        >
          <div className="grid gap-5 xl:grid-cols-2">
            <div className="grid gap-4">
              <LookupForm
                id="sports-market-id"
                label="Market id"
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
                  Enter a SportsHub market id to inspect state, result status, and reserved
                  exposure.
                </div>
              )}
            </div>

            <div className="grid gap-4">
              <LookupForm
                id="sports-ticket-id"
                label="Ticket id"
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
                  Enter a SportsHub ticket id to inspect position, stake, payout, and ticket state.
                </div>
              )}
            </div>
          </div>
        </SectionShell>

        <SectionShell
          eyebrow="Bankroll"
          title="Sports pool isolation"
          description="Sports liquidity is kept separate from casino game liquidity, so sportsbook exposure can be capped, paused, and monitored independently."
        >
          {sportsPools.length ? (
            <div className="grid gap-5">
              {sportsPools.map((pool) => (
                <PoolPanel key={pool.poolId} pool={pool} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-warn/25 bg-warn-soft p-4 text-sm leading-6 text-warn">
              No Sports pool metadata is available in this release.
            </div>
          )}
        </SectionShell>

        <SectionShell
          eyebrow="Controls"
          title="Launch blockers remain explicit"
          description="The page is intentionally operational: it keeps the SportsHub deployment visible while preserving the public-launch blockers tracked in the ops packet."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {CONTROL_LINKS.map((link) => (
              <Link
                key={link.detail}
                href={link.href}
                className="rounded-lg border border-border bg-surface-2/70 p-4 transition-colors hover:border-brand/30 hover:bg-surface-3"
              >
                <div className="text-sm font-semibold text-fg">{link.label}</div>
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
