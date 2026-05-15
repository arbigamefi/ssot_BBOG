"use client";

import * as React from "react";
import type { DomainSportsMarket, DomainSportsResult, DomainSportsTicket } from "@ssot/ssot";
import type { SSOTRelease } from "@ssot/ssot/release";
import { cn } from "@ssot/ui";

import { formatRawUnits, formatTimestamp, shortHex } from "./format";

type SportsPool = NonNullable<SSOTRelease["pools"]>[number];

export interface MarketTapeRow {
  market: DomainSportsMarket;
  result?: DomainSportsResult;
  reserved?: bigint;
}

export function DetailCell({
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
    <div className="rounded-lg border border-border bg-surface-1/70 p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-subtle">
        {label}
      </div>
      <div className={cn("mt-3 text-sm font-semibold text-fg", mono && "font-mono")}>{value}</div>
      {helper ? <div className="mt-2 text-xs leading-5 text-fg-muted">{helper}</div> : null}
    </div>
  );
}

export function LookupForm({
  id,
  label,
  value,
  onChange,
  onSubmit,
  disabled,
  error
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <form
      noValidate
      className="rounded-lg border border-border bg-surface-2/70 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor={id} className="text-xs font-bold uppercase tracking-[0.16em] text-fg-subtle">
        {label}
      </label>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          id={id}
          value={value}
          inputMode="numeric"
          pattern="[0-9]*"
          onChange={(event) => onChange(event.target.value)}
          placeholder="0"
          className="min-h-11 flex-1 rounded-md border border-border bg-surface-0 px-3 font-mono text-sm text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-brand"
        />
        <button
          type="submit"
          disabled={disabled}
          className="min-h-11 rounded-md bg-brand px-4 text-sm font-black text-fg-inverse shadow-glow transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Inspect
        </button>
      </div>
      {error ? <div className="mt-3 text-xs leading-5 text-danger">{error}</div> : null}
    </form>
  );
}

function KeyValueRows({ rows }: { rows: readonly [string, React.ReactNode][] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="divide-y divide-border-soft">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[180px_1fr]">
            <div className="text-fg-muted">{label}</div>
            <div className="break-all font-mono font-semibold text-fg">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MarketInspector({
  market,
  result,
  reserved
}: {
  market: DomainSportsMarket;
  result?: DomainSportsResult;
  reserved?: bigint;
}) {
  const resultStatus =
    !result || result.proposedAt === 0 ? "No result proposed" : "Result proposed";
  return (
    <div className="grid gap-5">
      <div>
        <div className="text-sm font-semibold text-fg">Market {market.marketId.toString()}</div>
        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-fg-subtle">
          {market.state} / pool {market.poolId}
        </div>
      </div>
      <KeyValueRows
        rows={[
          ["Event", market.eventId.toString()],
          ["Outcome count", String(market.outcomeCount)],
          ["Starts at", formatTimestamp(market.startsAt)],
          ["Locks at", formatTimestamp(market.lockTime)],
          ["Version", market.version.toString()],
          ["Market reserved", reserved === undefined ? "N/A" : reserved.toString()],
          ["Market key", shortHex(market.marketKey)],
          ["Rulebook", shortHex(market.rulebookHash)],
          ["Result", resultStatus],
          [
            "Winning outcome",
            result && result.proposedAt > 0 ? String(result.winningOutcomeId) : "N/A"
          ]
        ]}
      />
    </div>
  );
}

export function TicketInspector({ ticket }: { ticket: DomainSportsTicket }) {
  return (
    <div className="grid gap-5">
      <div>
        <div className="text-sm font-semibold text-fg">Ticket {ticket.ticketId.toString()}</div>
        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-fg-subtle">
          {ticket.state} / market {ticket.marketId.toString()}
        </div>
      </div>
      <KeyValueRows
        rows={[
          ["Position", ticket.positionId.toString()],
          ["Event", ticket.eventId.toString()],
          ["Pool", String(ticket.poolId)],
          ["Outcome", String(ticket.outcomeId)],
          ["Player", shortHex(ticket.player)],
          ["Stake", ticket.stake.toString()],
          ["Payout", ticket.payout.toString()],
          ["Reserved", ticket.reserved.toString()],
          ["Accepted at", formatTimestamp(ticket.acceptedAt)],
          ["Odds snapshot", shortHex(ticket.oddsSnapshotHash)]
        ]}
      />
    </div>
  );
}

export function StatusPill({
  children,
  tone
}: {
  children: React.ReactNode;
  tone: "success" | "warn" | "neutral";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
        tone === "success" && "border-success/30 bg-success-soft text-success",
        tone === "warn" && "border-warn/30 bg-warn-soft text-warn",
        tone === "neutral" && "border-border bg-surface-2 text-fg-muted"
      )}
    >
      {children}
    </span>
  );
}

function marketTone(state: DomainSportsMarket["state"]): "success" | "warn" | "neutral" {
  if (state === "open") return "success";
  if (state === "suspended" || state === "challenged" || state === "voided") return "warn";
  return "neutral";
}

function resultLabel(result?: DomainSportsResult) {
  if (!result || result.proposedAt === 0) return "No result";
  if (result.challenged) return "Challenged";
  return `Outcome ${result.winningOutcomeId}`;
}

export function MarketTape({
  rows,
  loading,
  error,
  onInspect
}: {
  rows: readonly MarketTapeRow[];
  loading?: boolean;
  error?: string;
  onInspect: (marketId: bigint) => void;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-surface-2/50 p-4 text-sm leading-6 text-fg-muted">
        Loading recent SportsHub markets...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger/25 bg-danger-soft p-4 text-sm leading-6 text-danger">
        {error}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-border bg-surface-2/50 p-4 text-sm leading-6 text-fg-muted">
        No SportsHub markets have been created in this release yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-border bg-surface-2 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-fg-subtle md:grid-cols-[1fr_140px_140px_120px_auto]">
        <div>Market</div>
        <div className="hidden md:block">Starts</div>
        <div className="hidden md:block">Reserved</div>
        <div className="hidden md:block">Result</div>
        <div className="text-right">Action</div>
      </div>
      <div className="divide-y divide-border-soft">
        {rows.map(({ market, result, reserved }) => (
          <div
            key={market.marketId.toString()}
            className="grid grid-cols-[1fr_auto] gap-3 px-4 py-4 md:grid-cols-[1fr_140px_140px_120px_auto] md:items-center"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold text-fg">
                  Market {market.marketId.toString()}
                </div>
                <StatusPill tone={marketTone(market.state)}>{market.state}</StatusPill>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-fg-muted">
                <span>Event {market.eventId.toString()}</span>
                <span>Pool {market.poolId}</span>
                <span>{market.outcomeCount} outcomes</span>
                <span>Locks {formatTimestamp(market.lockTime)}</span>
              </div>
            </div>
            <div className="hidden text-xs leading-5 text-fg-muted md:block">
              {formatTimestamp(market.startsAt)}
            </div>
            <div className="hidden font-mono text-xs font-semibold text-fg md:block">
              {reserved === undefined ? "N/A" : reserved.toLocaleString("en-US")}
            </div>
            <div className="hidden text-xs font-semibold text-fg md:block">
              {resultLabel(result)}
            </div>
            <button
              type="button"
              onClick={() => onInspect(market.marketId)}
              className="min-h-10 rounded-md border border-border bg-surface-2 px-3 text-xs font-bold text-fg transition-colors hover:border-brand/40 hover:bg-surface-3"
            >
              Load market
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SectionShell({
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
    <section className="rounded-lg border border-border bg-surface-1 p-6 shadow-e2 md:p-8">
      <div className="max-w-3xl">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-fg-subtle">
          {eyebrow}
        </div>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-fg md:text-3xl">{title}</h2>
        <p className="mt-3 text-sm leading-7 text-fg-muted">{description}</p>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function RiskRows({
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
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="border-b border-border bg-surface-2 px-4 py-3 text-sm font-semibold text-fg">
        {title}
      </div>
      <div className="divide-y divide-border-soft">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[180px_1fr]">
            <div className="text-fg-muted">{label}</div>
            <div className="break-all font-mono text-fg">
              {label === "Risk hash" ? shortHex(value) : formatRawUnits(value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PoolPanel({ pool }: { pool: SportsPool }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-fg">Pool {pool.poolId}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.16em] text-fg-subtle">
            {pool.domain || "Sports"} / domain {pool.domainId}
          </div>
        </div>
        <StatusPill tone={pool.active ? "success" : "warn"}>
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
