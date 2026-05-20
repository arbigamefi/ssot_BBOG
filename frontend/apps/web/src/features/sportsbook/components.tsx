"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { DomainSportsMarket, DomainSportsResult, DomainSportsTicket } from "@ssot/ssot";
import type { SSOTRelease } from "@ssot/ssot/release";
import { cn } from "@ssot/ui";

import { formatRawUnits, formatTimestamp, shortHex } from "./format";
import { providerOutcomeById } from "./provider-odds";
import { useSportsbookProviderOdds } from "./use-provider-odds";

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
  const t = useTranslations();

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
          {t("sportsbook.components.lookup.inspect")}
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
  const t = useTranslations();
  const resultStatus =
    !result || result.proposedAt === 0
      ? t("sportsbook.components.marketInspector.resultStatus.none")
      : t("sportsbook.components.marketInspector.resultStatus.proposed");
  return (
    <div className="grid gap-5">
      <div>
        <div className="text-sm font-semibold text-fg">
          {t("sportsbook.components.marketInspector.title", {
            marketId: market.marketId.toString()
          })}
        </div>
        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-fg-subtle">
          {t("sportsbook.components.marketInspector.stateLine", {
            state: market.state,
            poolId: String(market.poolId)
          })}
        </div>
      </div>
      <KeyValueRows
        rows={[
          [t("sportsbook.components.marketInspector.rows.event"), market.eventId.toString()],
          [
            t("sportsbook.components.marketInspector.rows.outcomeCount"),
            String(market.outcomeCount)
          ],
          [
            t("sportsbook.components.marketInspector.rows.startsAt"),
            formatTimestamp(market.startsAt)
          ],
          [
            t("sportsbook.components.marketInspector.rows.locksAt"),
            formatTimestamp(market.lockTime)
          ],
          [t("sportsbook.components.marketInspector.rows.version"), market.version.toString()],
          [
            t("sportsbook.components.marketInspector.rows.marketReserved"),
            reserved === undefined ? t("sportsbook.components.na") : reserved.toString()
          ],
          [t("sportsbook.components.marketInspector.rows.marketKey"), shortHex(market.marketKey)],
          [t("sportsbook.components.marketInspector.rows.rulebook"), shortHex(market.rulebookHash)],
          [t("sportsbook.components.marketInspector.rows.result"), resultStatus],
          [
            t("sportsbook.components.marketInspector.rows.winningOutcome"),
            result && result.proposedAt > 0
              ? String(result.winningOutcomeId)
              : t("sportsbook.components.na")
          ]
        ]}
      />
    </div>
  );
}

export function TicketInspector({ ticket }: { ticket: DomainSportsTicket }) {
  const t = useTranslations();
  return (
    <div className="grid gap-5">
      <div>
        <div className="text-sm font-semibold text-fg">
          {t("sportsbook.components.ticketInspector.title", {
            ticketId: ticket.ticketId.toString()
          })}
        </div>
        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-fg-subtle">
          {t("sportsbook.components.ticketInspector.stateLine", {
            state: ticket.state,
            marketId: ticket.marketId.toString()
          })}
        </div>
      </div>
      <KeyValueRows
        rows={[
          [t("sportsbook.components.ticketInspector.rows.position"), ticket.positionId.toString()],
          [t("sportsbook.components.ticketInspector.rows.event"), ticket.eventId.toString()],
          [t("sportsbook.components.ticketInspector.rows.pool"), String(ticket.poolId)],
          [t("sportsbook.components.ticketInspector.rows.outcome"), String(ticket.outcomeId)],
          [t("sportsbook.components.ticketInspector.rows.player"), shortHex(ticket.player)],
          [t("sportsbook.components.ticketInspector.rows.stake"), ticket.stake.toString()],
          [t("sportsbook.components.ticketInspector.rows.payout"), ticket.payout.toString()],
          [t("sportsbook.components.ticketInspector.rows.reserved"), ticket.reserved.toString()],
          [
            t("sportsbook.components.ticketInspector.rows.acceptedAt"),
            formatTimestamp(ticket.acceptedAt)
          ],
          [
            t("sportsbook.components.ticketInspector.rows.oddsSnapshot"),
            shortHex(ticket.oddsSnapshotHash)
          ]
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

export function sportsOutcomeLabel(
  outcomeId: number,
  outcomeCount: number,
  t: ReturnType<typeof useTranslations>
) {
  if (outcomeCount === 3) {
    if (outcomeId === 0) return t("sportsbook.ticketPlacement.outcomes.home");
    if (outcomeId === 1) return t("sportsbook.ticketPlacement.outcomes.draw");
    if (outcomeId === 2) return t("sportsbook.ticketPlacement.outcomes.away");
  }
  if (outcomeCount === 2) {
    if (outcomeId === 0) return t("sportsbook.ticketPlacement.outcomes.home");
    if (outcomeId === 1) return t("sportsbook.ticketPlacement.outcomes.away");
  }
  return t("sportsbook.ticketPlacement.outcomes.generic", { outcomeId: String(outcomeId) });
}

function resultLabel(
  result: DomainSportsResult | undefined,
  t: ReturnType<typeof useTranslations>
) {
  if (!result || result.proposedAt === 0) return t("sportsbook.components.marketTape.result.none");
  if (result.challenged) return t("sportsbook.components.marketTape.result.challenged");
  return t("sportsbook.components.marketTape.result.outcome", {
    outcomeId: String(result.winningOutcomeId)
  });
}

function PlayerMarketCard({
  row,
  ticketsEnabled
}: {
  row: MarketTapeRow;
  ticketsEnabled: boolean;
}) {
  const t = useTranslations();
  const { market, result } = row;
  const isOpen = market.state === "open";
  const providerOddsQuery = useSportsbookProviderOdds({
    marketId: market.marketId,
    enabled: ticketsEnabled && isOpen && market.outcomeCount === 3
  });
  const providerOdds = providerOddsQuery.data;
  const resultIsProposed = Boolean(result && result.proposedAt > 0);
  const winningOutcomeId = Number(result?.winningOutcomeId ?? -1);
  const winningOutcome =
    resultIsProposed && winningOutcomeId >= 0
      ? (providerOutcomeById(providerOdds, winningOutcomeId)?.name ??
        sportsOutcomeLabel(winningOutcomeId, market.outcomeCount, t))
      : undefined;
  const matchTitle = providerOdds
    ? t("sportsbook.components.playerMarkets.matchup", {
        home: providerOdds.event.homeTeam,
        away: providerOdds.event.awayTeam
      })
    : t("sportsbook.components.playerMarkets.title");

  return (
    <article className="rounded-lg border border-border bg-surface-2/70 p-5 transition-colors hover:border-brand/35 hover:bg-surface-2">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={marketTone(market.state)}>{market.state}</StatusPill>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-subtle">
              {t("sportsbook.components.playerMarkets.marketId", {
                marketId: market.marketId.toString()
              })}
            </span>
          </div>
          <h3 className="mt-3 text-xl font-black tracking-tight text-fg">{matchTitle}</h3>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-fg-muted">
            <span>
              {t("sportsbook.components.marketTape.event", {
                eventId: market.eventId.toString()
              })}
            </span>
            <span>
              {t("sportsbook.components.playerMarkets.starts", {
                time: providerOdds?.event.commenceTime
                  ? new Date(providerOdds.event.commenceTime).toLocaleString()
                  : formatTimestamp(market.startsAt)
              })}
            </span>
            <span>
              {t("sportsbook.components.marketTape.locks", {
                time: formatTimestamp(market.lockTime)
              })}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:flex-row lg:min-w-[260px]">
          <Link
            href={`/sportsbook/${market.marketId.toString()}`}
            className={cn(
              "inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-black transition-colors",
              isOpen && ticketsEnabled
                ? "bg-brand text-fg-inverse shadow-glow hover:bg-brand-hover"
                : "border border-border bg-surface-1 text-fg hover:border-brand/40 hover:bg-surface-3"
            )}
          >
            {isOpen && ticketsEnabled
              ? t("sportsbook.components.playerMarkets.openTicket")
              : t("sportsbook.components.playerMarkets.viewMarket")}
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {Array.from({ length: market.outcomeCount }, (_, outcomeId) => {
          const isWinner = resultIsProposed && Number(result?.winningOutcomeId ?? -1) === outcomeId;
          const providerOutcome = providerOutcomeById(providerOdds, outcomeId);
          return (
            <Link
              key={outcomeId}
              href={`/sportsbook/${market.marketId.toString()}?outcome=${outcomeId}`}
              className={cn(
                "rounded-md border px-4 py-3 transition-colors",
                isWinner
                  ? "border-success/35 bg-success-soft hover:border-success"
                  : "border-border bg-surface-1/70 hover:border-brand/40 hover:bg-surface-3"
              )}
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
                {t("sportsbook.components.playerMarkets.outcome")}
              </div>
              <div className={cn("mt-1 text-sm font-black", isWinner ? "text-success" : "text-fg")}>
                {providerOutcome?.name ?? sportsOutcomeLabel(outcomeId, market.outcomeCount, t)}
              </div>
              {providerOutcome ? (
                <div className="mt-2 font-mono text-lg font-black text-brand">
                  {t("sportsbook.ticketPlacement.outcomes.price", {
                    price: providerOutcome.decimalPrice
                  })}
                </div>
              ) : null}
            </Link>
          );
        })}
      </div>

      <div className="mt-4 text-xs leading-5 text-fg-muted">
        {resultIsProposed
          ? t("sportsbook.components.playerMarkets.result", {
              outcome: winningOutcome ?? sportsOutcomeLabel(0, market.outcomeCount, t)
            })
          : providerOdds
            ? t("sportsbook.components.playerMarkets.liveOddsHelper", {
                bookmaker:
                  providerOdds.provider.bookmakerTitle ??
                  providerOdds.provider.bookmakerKey ??
                  "provider"
              })
            : providerOddsQuery.error
              ? t("sportsbook.components.playerMarkets.providerUnavailable")
              : isOpen
                ? t("sportsbook.components.playerMarkets.openHelper")
                : t("sportsbook.components.playerMarkets.closedHelper")}
      </div>
    </article>
  );
}

export function PlayerMarketList({
  rows,
  loading,
  error,
  ticketsEnabled
}: {
  rows: readonly MarketTapeRow[];
  loading?: boolean;
  error?: string;
  ticketsEnabled: boolean;
}) {
  const t = useTranslations();

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-surface-2/50 p-4 text-sm leading-6 text-fg-muted">
        {t("sportsbook.components.playerMarkets.loading")}
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
        {t("sportsbook.components.playerMarkets.empty")}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {rows.map((row) => (
        <PlayerMarketCard
          key={row.market.marketId.toString()}
          row={row}
          ticketsEnabled={ticketsEnabled}
        />
      ))}
    </div>
  );
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
  const t = useTranslations();

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-surface-2/50 p-4 text-sm leading-6 text-fg-muted">
        {t("sportsbook.components.marketTape.loading")}
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
        {t("sportsbook.components.marketTape.empty")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-border bg-surface-2 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-fg-subtle md:grid-cols-[1fr_140px_140px_120px_auto]">
        <div>{t("sportsbook.components.marketTape.columns.market")}</div>
        <div className="hidden md:block">
          {t("sportsbook.components.marketTape.columns.starts")}
        </div>
        <div className="hidden md:block">
          {t("sportsbook.components.marketTape.columns.reserved")}
        </div>
        <div className="hidden md:block">
          {t("sportsbook.components.marketTape.columns.result")}
        </div>
        <div className="text-right">{t("sportsbook.components.marketTape.columns.actions")}</div>
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
                  {t("sportsbook.components.marketTape.marketTitle", {
                    marketId: market.marketId.toString()
                  })}
                </div>
                <StatusPill tone={marketTone(market.state)}>{market.state}</StatusPill>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-fg-muted">
                <span>
                  {t("sportsbook.components.marketTape.event", {
                    eventId: market.eventId.toString()
                  })}
                </span>
                <span>
                  {t("sportsbook.components.marketTape.pool", {
                    poolId: String(market.poolId)
                  })}
                </span>
                <span>
                  {t("sportsbook.components.marketTape.outcomes", {
                    count: String(market.outcomeCount)
                  })}
                </span>
                <span>
                  {t("sportsbook.components.marketTape.locks", {
                    time: formatTimestamp(market.lockTime)
                  })}
                </span>
              </div>
            </div>
            <div className="hidden text-xs leading-5 text-fg-muted md:block">
              {formatTimestamp(market.startsAt)}
            </div>
            <div className="hidden font-mono text-xs font-semibold text-fg md:block">
              {reserved === undefined
                ? t("sportsbook.components.na")
                : reserved.toLocaleString("en-US")}
            </div>
            <div className="hidden text-xs font-semibold text-fg md:block">
              {resultLabel(result, t)}
            </div>
            <div className="flex flex-col justify-end gap-2 sm:flex-row">
              <Link
                href={`/sportsbook/${market.marketId.toString()}`}
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-brand px-3 text-xs font-bold text-fg-inverse shadow-glow transition-colors hover:bg-brand-hover"
              >
                {t("sportsbook.components.marketTape.actions.open")}
              </Link>
              <button
                type="button"
                onClick={() => onInspect(market.marketId)}
                className="min-h-10 rounded-md border border-border bg-surface-2 px-3 text-xs font-bold text-fg transition-colors hover:border-brand/40 hover:bg-surface-3"
              >
                {t("sportsbook.components.marketTape.actions.load")}
              </button>
            </div>
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
  className,
  children
}: {
  eyebrow: string;
  title: string;
  description: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn("rounded-lg border border-border bg-surface-1 p-6 shadow-e2 md:p-8", className)}
    >
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
  const t = useTranslations();
  const rows = [
    ["maxStake", t("sportsbook.components.riskRows.maxStake"), risk.maxStake],
    ["maxPayout", t("sportsbook.components.riskRows.maxPayout"), risk.maxPayout],
    ["marketReserved", t("sportsbook.components.riskRows.marketReserved"), risk.maxMarketReserved],
    [
      "outcomeReserved",
      t("sportsbook.components.riskRows.outcomeReserved"),
      risk.maxOutcomeReserved
    ],
    ["eventReserved", t("sportsbook.components.riskRows.eventReserved"), risk.maxEventReserved],
    ["riskHash", t("sportsbook.components.riskRows.riskHash"), risk.riskHash]
  ] as const;

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="border-b border-border bg-surface-2 px-4 py-3 text-sm font-semibold text-fg">
        {title}
      </div>
      <div className="divide-y divide-border-soft">
        {rows.map(([key, label, value]) => (
          <div key={key} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[180px_1fr]">
            <div className="text-fg-muted">{label}</div>
            <div className="break-all font-mono text-fg">
              {key === "riskHash" ? shortHex(value) : formatRawUnits(value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PoolPanel({ pool }: { pool: SportsPool }) {
  const t = useTranslations();
  return (
    <div className="rounded-lg border border-border bg-surface-2/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-fg">
            {t("sportsbook.components.poolPanel.title", { poolId: String(pool.poolId) })}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.16em] text-fg-subtle">
            {t("sportsbook.components.poolPanel.domainLine", {
              domain: pool.domain || t("sportsbook.components.poolPanel.defaultDomain"),
              domainId: String(pool.domainId)
            })}
          </div>
        </div>
        <StatusPill tone={pool.active ? "success" : "warn"}>
          {pool.active
            ? t("sportsbook.components.poolPanel.active")
            : t("sportsbook.components.poolPanel.paused")}
        </StatusPill>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <DetailCell label={t("sportsbook.components.poolPanel.bank")} value={shortHex(pool.bank)} />
        <DetailCell
          label={t("sportsbook.components.poolPanel.asset")}
          value={shortHex(pool.asset)}
        />
        <DetailCell
          label={t("sportsbook.components.poolPanel.units")}
          value={
            pool.symbol ||
            t("sportsbook.components.poolPanel.rawUnits", { decimals: String(pool.decimals) })
          }
          mono={false}
        />
      </div>

      {pool.sportsRisk ? (
        <div className="mt-5">
          <RiskRows title={t("sportsbook.components.poolPanel.riskTitle")} risk={pool.sportsRisk} />
        </div>
      ) : null}
    </div>
  );
}
