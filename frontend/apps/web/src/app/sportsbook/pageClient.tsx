"use client";

import * as React from "react";
import Link from "next/link";
import type { SSOTRelease } from "@ssot/ssot/release";
import { cn } from "@ssot/ui";

import { PageTransition } from "../../components/PageTransition";
import { useRelease } from "../../ssot/release/ReleaseProvider";

type SportsPool = NonNullable<SSOTRelease["pools"]>[number];

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

function shortHex(value?: string) {
  if (!value) return "N/A";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatRawUnits(value?: string) {
  if (!value) return "N/A";
  try {
    return BigInt(value).toLocaleString("en-US");
  } catch {
    return value;
  }
}

function formatDuration(value?: string) {
  if (!value) return "N/A";
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return value;
  const days = seconds / 86_400;
  if (Number.isInteger(days)) return `${days}d`;
  const hours = seconds / 3_600;
  if (Number.isInteger(hours)) return `${hours}h`;
  return `${seconds}s`;
}

function getSportsPools(release: SSOTRelease) {
  return (release.pools ?? []).filter(
    (pool) => pool.domain.toLowerCase() === "sports" || Boolean(pool.sportsRisk)
  );
}

function DetailCell({
  label,
  value,
  helper,
  mono = true
}: {
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.03] p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">{label}</div>
      <div className={cn("mt-3 text-sm font-semibold text-white", mono && "font-mono")}>
        {value}
      </div>
      {helper ? <div className="mt-2 text-xs leading-5 text-white/42">{helper}</div> : null}
    </div>
  );
}

function StatusPill({
  children,
  tone
}: {
  children: React.ReactNode;
  tone: "green" | "amber" | "slate";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
        tone === "green" && "border-emerald-400/28 bg-emerald-400/10 text-emerald-200",
        tone === "amber" && "border-amber-400/28 bg-amber-400/10 text-amber-200",
        tone === "slate" && "border-white/10 bg-white/[0.04] text-white/60"
      )}
    >
      {children}
    </span>
  );
}

function SectionShell({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow: string;
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white/8 bg-[#080c12] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:p-8">
      <div className="max-w-3xl">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
          {eyebrow}
        </div>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-white md:text-3xl">{title}</h2>
        <p className="mt-3 text-sm leading-7 text-white/48">{description}</p>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function RiskRows({
  title,
  risk
}: {
  title: string;
  risk: {
    maxStake?: string;
    maxPayout?: string;
    maxMarketReserved?: string;
    maxOutcomeReserved?: string;
    maxEventReserved?: string;
    riskHash?: string;
  };
}) {
  const rows = [
    ["Max stake", risk.maxStake],
    ["Max payout", risk.maxPayout],
    ["Market reserved", risk.maxMarketReserved],
    ["Outcome reserved", risk.maxOutcomeReserved],
    ["Event reserved", risk.maxEventReserved],
    ["Risk hash", risk.riskHash]
  ] as const;

  return (
    <div className="overflow-hidden rounded-lg border border-white/8">
      <div className="border-b border-white/8 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white">
        {title}
      </div>
      <div className="divide-y divide-white/8">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[180px_1fr]">
            <div className="text-white/46">{label}</div>
            <div className="break-all font-mono text-white/82">
              {label === "Risk hash" ? shortHex(value) : formatRawUnits(value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PoolPanel({ pool }: { pool: SportsPool }) {
  return (
    <div className="rounded-lg border border-white/8 bg-black/20 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">Pool {pool.poolId}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/35">
            {pool.domain || "Sports"} / domain {pool.domainId}
          </div>
        </div>
        <StatusPill tone={pool.active ? "green" : "amber"}>
          {pool.active ? "Active" : "Paused"}
        </StatusPill>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <DetailCell label="Bank" value={shortHex(pool.bank)} />
        <DetailCell label="Asset" value={shortHex(pool.asset)} />
        <DetailCell
          label="Units"
          value={pool.symbol || `raw / ${pool.decimals} decimals`}
          mono={false}
        />
      </div>

      {pool.sportsRisk ? (
        <div className="mt-5">
          <RiskRows title="Pool risk caps" risk={pool.sportsRisk} />
        </div>
      ) : null}
    </div>
  );
}

export function SportsbookPageClient() {
  const { release, readOnlyReason, sportsbook } = useRelease();

  if (!release) {
    return (
      <PageTransition pageKey="sportsbook">
        <div className="mx-auto max-w-3xl py-16">
          <SectionShell
            eyebrow="Sportsbook"
            title="No release loaded"
            description={readOnlyReason ?? "The embedded release snapshot is unavailable."}
          >
            <StatusPill tone="amber">Unavailable</StatusPill>
          </SectionShell>
        </div>
      </PageTransition>
    );
  }

  const sports = release.sports;
  const sportsHub = sports?.hub ?? release.contracts.sportsHub;
  const riskEngine = sports?.riskEngine ?? release.contracts.sportsRiskEngine;
  const sportsPools = getSportsPools(release);
  const statusTone = sportsbook.enabled ? "green" : "amber";
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
              <StatusPill tone={sportsbook.hasSportsRelease ? "green" : "amber"}>
                {sportsbook.hasSportsRelease ? "SportsHub present" : "SportsHub missing"}
              </StatusPill>
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-5xl">
              Sportsbook Control Room
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/52 md:text-[15px]">
              Fixed-odds sports markets stay behind explicit launch controls. This entry exposes the
              deployed SportsHub surface and release risk caps without opening public ticket
              placement.
            </p>
          </div>

          <div className="rounded-lg border border-white/8 bg-white/[0.03] p-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
              Public risk-in
            </div>
            <div className="mt-3 text-2xl font-black text-white">Locked</div>
            <p className="mt-2 text-sm leading-6 text-white/46">
              {sportsbook.disabledReason ??
                "Ticket placement remains outside this read-only frontend phase."}
            </p>
            <button
              type="button"
              disabled
              className="mt-5 w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/36"
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
                  className="flex items-center justify-between gap-4 rounded-lg border border-white/8 bg-black/20 px-4 py-3"
                >
                  <div className="text-sm text-white/46">{label}</div>
                  <div className="text-right text-sm font-semibold text-white">{value}</div>
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
            <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
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
                className="rounded-lg border border-white/8 bg-white/[0.03] p-4 transition-colors hover:border-white/16 hover:bg-white/[0.06]"
              >
                <div className="text-sm font-semibold text-white">{link.label}</div>
                <div className="mt-3 break-all font-mono text-xs leading-5 text-white/42">
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
