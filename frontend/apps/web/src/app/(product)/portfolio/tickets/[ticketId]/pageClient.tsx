"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import type { DomainSportsMarket, DomainSportsResult, DomainSportsTicket } from "@ssot/ssot";
import { ErrorCallout, toast, TxStatusChip, TxStepper } from "@ssot/ui";

import { PageTransition } from "../../../../../components/PageTransition";
import { MarketStateBadge } from "../../../../../features/sportsbook/MarketStateBadge";
import { ResultPanel } from "../../../../../features/sportsbook/ResultPanel";
import {
  describeMarketWallClock,
  marketShortTag
} from "../../../../../features/sportsbook/player-format";
import { providerOutcomeById } from "../../../../../features/sportsbook/provider-odds";
import { useSportsbookProviderOdds } from "../../../../../features/sportsbook/use-provider-odds";
import { useDirectTxAction } from "../../../../../features/tx/useDirectTxAction";
import { useRelease } from "../../../../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../../../../ssot/sdk";

interface TicketReadback {
  ticket: DomainSportsTicket;
  market?: DomainSportsMarket;
  result?: DomainSportsResult;
}

function parseTicketId(input: string): bigint | undefined {
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

export function SportsTicketDetailPageClient({ ticketId }: { ticketId: string }) {
  const t = useTranslations("sportsbook.player.ticket");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const { release, chainId, readOnly } = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const parsedTicketId = React.useMemo(() => parseTicketId(ticketId), [ticketId]);
  const txHash = searchParams.get("tx") ?? undefined;

  const {
    data: readback,
    error,
    isFetching,
    refetch: refetchReadback
  } = useQuery({
    queryKey: [
      "sportsbook",
      "ticket-detail",
      release?.releaseDigest ?? "none",
      parsedTicketId?.toString() ?? "invalid"
    ],
    enabled: Boolean(release && sdk && ready && parsedTicketId !== undefined),
    retry: false,
    staleTime: 3_000,
    refetchInterval: 5_000,
    queryFn: async (): Promise<TicketReadback | undefined> => {
      if (!sdk || parsedTicketId === undefined) return undefined;
      const ticket = await sdk.sportsHub.getTicket(parsedTicketId);
      const [market, result] = await Promise.all([
        sdk.sportsHub.getMarket(ticket.marketId).catch(() => undefined),
        sdk.sportsHub.getResult(ticket.marketId).catch(() => undefined)
      ]);
      return { ticket, market, result };
    }
  });

  const settleFlow = useDirectTxAction({
    action: "SPORTS_SETTLE_TICKET",
    errorMessage: t("toast.settleFailed"),
    labels: {
      preflight: t("flows.preflight"),
      submit: t("flows.settle.submit"),
      confirm: t("flows.confirm")
    },
    descriptions: {
      preflight: t("flows.settle.preflight"),
      submit: t("flows.settle.broadcast"),
      confirm: t("flows.receipt")
    }
  });

  const refundFlow = useDirectTxAction({
    action: "SPORTS_REFUND_TICKET",
    errorMessage: t("toast.refundFailed"),
    labels: {
      preflight: t("flows.preflight"),
      submit: t("flows.refund.submit"),
      confirm: t("flows.confirm")
    },
    descriptions: {
      preflight: t("flows.refund.preflight"),
      submit: t("flows.refund.broadcast"),
      confirm: t("flows.receipt")
    }
  });

  const providerOddsQuery = useSportsbookProviderOdds({
    marketId: readback?.ticket.marketId,
    enabled: Boolean(readback?.ticket.marketId)
  });
  const providerOdds = providerOddsQuery.data;

  const handleSettle = React.useCallback(async () => {
    if (!sdk || parsedTicketId === undefined) return;
    const result = await settleFlow.execute(() => sdk.sportsHub.settleTicket(parsedTicketId));
    if (result.ok) {
      toast.success(t("toast.settled"));
      void refetchReadback();
      return;
    }
    toast.error(result.error?.message ?? t("toast.settleFailed"));
  }, [parsedTicketId, refetchReadback, sdk, settleFlow, t]);

  const handleRefund = React.useCallback(async () => {
    if (!sdk || parsedTicketId === undefined) return;
    const result = await refundFlow.execute(() => sdk.sportsHub.refundTicket(parsedTicketId));
    if (result.ok) {
      toast.success(t("toast.refunded"));
      void refetchReadback();
      return;
    }
    toast.error(result.error?.message ?? t("toast.refundFailed"));
  }, [parsedTicketId, refetchReadback, refundFlow, sdk, t]);

  if (!release) {
    return (
      <PageTransition pageKey={`sports-ticket-${ticketId}`}>
        <NoticeCard title={t("noRelease.title")} description={t("noRelease.description")} />
      </PageTransition>
    );
  }

  if (parsedTicketId === undefined) {
    return (
      <PageTransition pageKey={`sports-ticket-${ticketId}`}>
        <NoticeCard
          title={t("invalid.title")}
          description={t("invalid.description")}
          cta={{ label: t("invalid.back"), href: "/portfolio/activity" }}
        />
      </PageTransition>
    );
  }

  if (error) {
    return (
      <PageTransition pageKey={`sports-ticket-${ticketId}`}>
        <NoticeCard
          tone="danger"
          title={t("readFailed.title")}
          description={t("readFailed.description")}
          cta={{ label: t("invalid.back"), href: "/portfolio/activity" }}
        />
      </PageTransition>
    );
  }

  if (!readback) {
    return (
      <PageTransition pageKey={`sports-ticket-${ticketId}`}>
        <div className="mx-auto flex max-w-[1100px] flex-col gap-6 py-10 md:py-12">
          <div className="h-7 w-36 animate-pulse rounded bg-surface-2" />
          <div className="h-12 w-72 animate-pulse rounded bg-surface-2" />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="h-28 animate-pulse rounded-lg border border-border bg-surface-1" />
            <div className="h-28 animate-pulse rounded-lg border border-border bg-surface-1" />
            <div className="h-28 animate-pulse rounded-lg border border-border bg-surface-1" />
          </div>
        </div>
      </PageTransition>
    );
  }

  const { ticket, market, result } = readback;
  const asset = getPoolAsset(release, ticket.poolId);
  const selected = providerOutcomeById(providerOdds, ticket.outcomeId);
  const winning =
    result && result.proposedAt > 0
      ? providerOutcomeById(providerOdds, Number(result.winningOutcomeId))
      : undefined;
  const status = describeTicketStatus(ticket, result, t);
  const outcomeLabel = selected?.name ?? t("fallbackOutcome", { outcomeId: ticket.outcomeId + 1 });
  const winningLabel =
    result && result.proposedAt > 0
      ? (winning?.name ?? t("fallbackOutcome", { outcomeId: result.winningOutcomeId + 1 }))
      : undefined;
  const eventTitle = providerOdds
    ? t("eventTitle", {
        away: providerOdds.event.awayTeam,
        home: providerOdds.event.homeTeam
      })
    : market
      ? t("fallbackMarket", { tag: marketShortTag(market.marketKey) })
      : t("fallbackTicket", { ticketId });
  const clock = market ? describeMarketWallClock(market, Date.now(), locale) : undefined;
  const explorerTx = txHash ? explorerTxUrl(chainId, txHash) : undefined;
  const lifecycle = describeTicketLifecycle(ticket, market, result, locale, t);
  const hasWritableAccount = !readOnly && Boolean(sdk?.account);
  const canSettle = lifecycle.kind === "settle-ready" && hasWritableAccount;
  const canRefund = lifecycle.kind === "refund-ready" && hasWritableAccount;
  const activeFlow = settleFlow.hasActivity
    ? settleFlow
    : refundFlow.hasActivity
      ? refundFlow
      : null;
  const explorerBaseUrl = explorerBaseUrlForChain(chainId);

  return (
    <PageTransition pageKey={`sports-ticket-${ticketId}`}>
      <div className="mx-auto flex max-w-[1100px] flex-col gap-8 py-10 md:py-12">
        <header className="flex flex-col gap-4">
          <Link
            href="/portfolio/activity"
            className="inline-flex h-7 items-center gap-1.5 self-start text-sm font-medium text-fg-muted transition-colors hover:text-fg"
          >
            <span aria-hidden>‹</span>
            {t("back")}
          </Link>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
            <span className={status.className}>{status.label}</span>
            {market ? (
              <>
                <span aria-hidden>·</span>
                <MarketStateBadge state={market.state} clock={clock} size="small" />
              </>
            ) : null}
            {(providerOdds?.provider.bookmakerTitle ?? providerOdds?.provider.bookmakerKey) ? (
              <>
                <span aria-hidden>·</span>
                <span>
                  {t("bookmaker", {
                    name:
                      providerOdds.provider.bookmakerTitle ??
                      providerOdds.provider.bookmakerKey ??
                      ""
                  })}
                </span>
              </>
            ) : null}
          </div>

          <div className="grid gap-2">
            <h1 className="text-3xl font-semibold tracking-tight text-fg md:text-4xl">
              {eventTitle}
            </h1>
            <p className="text-sm text-fg-muted">
              {t("subtitle", { ticketId: ticket.ticketId.toString() })}
            </p>
          </div>
        </header>

        {market ? <ResultPanel market={market} result={result} odds={providerOdds} /> : null}

        <section className="grid gap-4 md:grid-cols-3">
          <Metric
            label={t("metrics.selection")}
            value={outcomeLabel}
            detail={
              selected?.decimalPrice ? t("metrics.price", { price: selected.decimalPrice }) : "—"
            }
          />
          <Metric
            label={t("metrics.stake")}
            value={formatAmount(ticket.stake, asset.decimals, asset.symbol)}
            detail={t("metrics.pool", { poolId: ticket.poolId })}
          />
          <Metric
            label={t("metrics.payout")}
            value={formatAmount(ticket.payout, asset.decimals, asset.symbol)}
            detail={
              winningLabel
                ? t("metrics.winner", { outcome: winningLabel })
                : t("metrics.pendingResult")
            }
            tone={status.tone}
          />
        </section>

        <TicketLifecyclePanel
          lifecycle={lifecycle}
          canSettle={canSettle}
          canRefund={canRefund}
          settleFlow={settleFlow}
          refundFlow={refundFlow}
          activeFlow={activeFlow}
          explorerBaseUrl={explorerBaseUrl}
          onSettle={() => void handleSettle()}
          onRefund={() => void handleRefund()}
          t={t}
        />

        <section className="rounded-lg border border-border bg-surface-1 p-4 md:p-5">
          <header className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-fg-subtle">
              {t("facts.title")}
            </h2>
            {isFetching ? <span className="text-xs text-fg-subtle">{t("refreshing")}</span> : null}
          </header>
          <dl className="grid gap-3 md:grid-cols-2">
            <Fact label={t("facts.ticketId")} value={`#${ticket.ticketId.toString()}`} />
            <Fact label={t("facts.marketId")} value={`#${ticket.marketId.toString()}`} />
            <Fact label={t("facts.positionId")} value={ticket.positionId.toString()} />
            <Fact
              label={t("facts.acceptedAt")}
              value={formatTimestamp(ticket.acceptedAt, locale)}
            />
            <Fact label={t("facts.player")} value={shortHex(ticket.player)} copy={ticket.player} />
            <Fact label={t("facts.ticketState")} value={ticket.state} />
            <Fact
              label={t("facts.oddsSnapshotHash")}
              value={shortHex(ticket.oddsSnapshotHash)}
              copy={ticket.oddsSnapshotHash}
            />
            <Fact
              label={t("facts.rulebookHash")}
              value={shortHex(ticket.rulebookHash)}
              copy={ticket.rulebookHash}
            />
            {txHash ? (
              <Fact
                label={t("facts.placeTx")}
                value={shortHex(txHash)}
                copy={txHash}
                href={explorerTx}
              />
            ) : null}
          </dl>
        </section>

        <div className="flex flex-wrap gap-3">
          {market ? (
            <Link
              href={`/sportsbook/${ticket.marketId.toString()}?outcome=${ticket.outcomeId}`}
              className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-semibold text-fg-inverse transition-colors hover:bg-brand-hover"
            >
              {t("actions.openMarket")}
            </Link>
          ) : null}
          <Link
            href={`/ops/sportsbook?ticketId=${ticket.ticketId.toString()}`}
            className="inline-flex h-10 items-center rounded-md border border-border bg-surface-2 px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-3"
          >
            {t("actions.ops")}
          </Link>
        </div>
      </div>
    </PageTransition>
  );
}

type TicketLifecycle =
  | {
      kind: "settled" | "refunded" | "voided" | "settle-ready" | "refund-ready" | "held";
      title: string;
      description: string;
      detail?: string;
      tone: "default" | "success" | "danger" | "brand" | "warn";
    }
  | {
      kind: "finality-pending";
      title: string;
      description: string;
      detail: string;
      tone: "brand";
    };

type SportsTicketActionFlow = ReturnType<typeof useDirectTxAction>;

function TicketLifecyclePanel({
  lifecycle,
  canSettle,
  canRefund,
  settleFlow,
  refundFlow,
  activeFlow,
  explorerBaseUrl,
  onSettle,
  onRefund,
  t
}: {
  lifecycle: TicketLifecycle;
  canSettle: boolean;
  canRefund: boolean;
  settleFlow: SportsTicketActionFlow;
  refundFlow: SportsTicketActionFlow;
  activeFlow: SportsTicketActionFlow | null;
  explorerBaseUrl?: string;
  onSettle: () => void;
  onRefund: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const busy = settleFlow.busy || refundFlow.busy;
  const toneClass =
    lifecycle.tone === "success"
      ? "border-success/30 bg-success-soft"
      : lifecycle.tone === "danger"
        ? "border-danger/30 bg-danger-soft"
        : lifecycle.tone === "warn"
          ? "border-warn/30 bg-warn-soft"
          : lifecycle.tone === "brand"
            ? "border-brand/30 bg-brand-soft"
            : "border-border bg-surface-1";

  return (
    <section className={`rounded-lg border p-4 md:p-5 ${toneClass}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-subtle">
            {t("lifecycle.eyebrow")}
          </div>
          <h2 className="mt-2 text-xl font-semibold text-fg">{lifecycle.title}</h2>
          <p className="mt-2 text-sm leading-6 text-fg-muted">{lifecycle.description}</p>
          {lifecycle.detail ? (
            <p className="mt-2 text-xs font-medium text-fg-subtle">{lifecycle.detail}</p>
          ) : null}
        </div>

        {canSettle || canRefund ? (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
            {canSettle ? (
              <button
                type="button"
                onClick={onSettle}
                disabled={busy}
                className="inline-flex h-10 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-fg-inverse transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {settleFlow.busy ? t("actions.settling") : t("actions.settle")}
              </button>
            ) : null}
            {canRefund ? (
              <button
                type="button"
                onClick={onRefund}
                disabled={busy}
                className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface-2 px-4 text-sm font-semibold text-fg transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {refundFlow.busy ? t("actions.refunding") : t("actions.refund")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {activeFlow?.hasActivity ? (
        <div className="mt-5 space-y-3">
          {activeFlow.error ? (
            <ErrorCallout
              title={t("actions.transactionError")}
              message={activeFlow.error.message}
            />
          ) : null}
          <TxStepper
            title={activeFlow === refundFlow ? t("actions.refundTrace") : t("actions.settleTrace")}
            subtitle={t("actions.traceSubtitle")}
            steps={[...activeFlow.steps]}
            footer={
              <div className="space-y-2 text-xs text-fg-muted">
                <div className="flex items-center justify-between gap-3">
                  <span>{t("actions.status")}</span>
                  <TxStatusChip status={activeFlow.status} />
                </div>
                {activeFlow.txHash ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono">{shortHex(activeFlow.txHash)}</span>
                    {explorerBaseUrl ? (
                      <Link
                        href={`${explorerBaseUrl}/tx/${activeFlow.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-brand hover:text-brand-hover"
                      >
                        {t("actions.viewExplorer")}
                      </Link>
                    ) : null}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={activeFlow.reset}
                  className="font-bold hover:text-fg"
                >
                  {t("actions.resetTrace")}
                </button>
              </div>
            }
          />
        </div>
      ) : null}
    </section>
  );
}

function Metric({
  label,
  value,
  detail,
  tone = "default"
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "success" | "danger" | "brand";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : tone === "brand"
          ? "text-brand"
          : "text-fg";
  return (
    <div className="rounded-lg border border-border bg-surface-1 p-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
        {label}
      </div>
      <div className={`mt-2 truncate text-xl font-semibold ${toneClass}`}>{value}</div>
      <div className="mt-1 text-xs text-fg-muted">{detail}</div>
    </div>
  );
}

function Fact({
  label,
  value,
  copy,
  href
}: {
  label: string;
  value: string;
  copy?: string;
  href?: string;
}) {
  const content = href ? (
    <Link href={href} className="text-brand transition-colors hover:text-brand-hover">
      {value}
    </Link>
  ) : (
    value
  );
  return (
    <div className="rounded-md border border-border-soft bg-surface-2/60 px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-sm text-fg" title={copy}>
        {content}
      </dd>
    </div>
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
    <div className={`mx-auto mt-16 flex max-w-3xl flex-col gap-3 rounded-lg border p-6 ${tones}`}>
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

function describeTicketStatus(
  ticket: DomainSportsTicket,
  result: DomainSportsResult | undefined,
  t: ReturnType<typeof useTranslations>
) {
  if (ticket.state === "settled") {
    const won = result?.proposedAt
      ? Number(result.winningOutcomeId) === ticket.outcomeId
      : undefined;
    if (won === true) {
      return { label: t("status.won"), tone: "success" as const, className: "text-success" };
    }
    if (won === false) {
      return { label: t("status.lost"), tone: "danger" as const, className: "text-danger" };
    }
    return { label: t("status.settled"), tone: "success" as const, className: "text-success" };
  }
  if (ticket.state === "refunded") {
    return { label: t("status.refunded"), tone: "brand" as const, className: "text-brand" };
  }
  if (ticket.state === "voided") {
    return { label: t("status.voided"), tone: "danger" as const, className: "text-danger" };
  }
  if (result?.proposedAt) {
    return { label: t("status.resultReady"), tone: "brand" as const, className: "text-brand" };
  }
  return { label: t("status.held"), tone: "default" as const, className: "text-fg-subtle" };
}

function describeTicketLifecycle(
  ticket: DomainSportsTicket,
  market: DomainSportsMarket | undefined,
  result: DomainSportsResult | undefined,
  locale: string,
  t: ReturnType<typeof useTranslations>
): TicketLifecycle {
  if (ticket.state === "settled") {
    return {
      kind: "settled",
      title: t("lifecycle.settled.title"),
      description: t("lifecycle.settled.description"),
      tone: "success"
    };
  }
  if (ticket.state === "refunded") {
    return {
      kind: "refunded",
      title: t("lifecycle.refunded.title"),
      description: t("lifecycle.refunded.description"),
      tone: "brand"
    };
  }
  if (ticket.state === "voided") {
    return {
      kind: "voided",
      title: t("lifecycle.voided.title"),
      description: t("lifecycle.voided.description"),
      tone: "danger"
    };
  }

  if (market?.state === "resolved") {
    return {
      kind: "settle-ready",
      title: t("lifecycle.settleReady.title"),
      description: t("lifecycle.settleReady.description"),
      tone: "brand"
    };
  }

  if (market?.state === "voided") {
    return {
      kind: "refund-ready",
      title: t("lifecycle.refundReady.title"),
      description: t("lifecycle.refundReady.description"),
      tone: "warn"
    };
  }

  if (result?.proposedAt && result.finalizesAt > Math.floor(Date.now() / 1000)) {
    return {
      kind: "finality-pending",
      title: t("lifecycle.finalityPending.title"),
      description: t("lifecycle.finalityPending.description"),
      detail: t("lifecycle.finalityPending.detail", {
        time: formatTimestamp(result.finalizesAt, locale)
      }),
      tone: "brand"
    };
  }

  if (result?.proposedAt) {
    return {
      kind: "held",
      title: t("lifecycle.resultReady.title"),
      description: t("lifecycle.resultReady.description"),
      tone: "brand"
    };
  }

  return {
    kind: "held",
    title: t("lifecycle.held.title"),
    description: t("lifecycle.held.description"),
    tone: "default"
  };
}

function formatAmount(value: bigint, decimals: number, symbol: string): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const fraction = abs % base;
  const fractionStr = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  const numeric = fractionStr ? `${whole.toString()}.${fractionStr}` : whole.toString();
  return `${negative ? "-" : ""}${numeric} ${symbol}`;
}

function formatTimestamp(value: number, locale: string): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(value * 1000)
    );
  } catch {
    return new Date(value * 1000).toISOString();
  }
}

function shortHex(value: string | undefined): string {
  if (!value || value.length <= 12) return value ?? "—";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function explorerTxUrl(chainId: number, txHash: string): string | undefined {
  const base = explorerBaseUrlForChain(chainId);
  return base ? `${base}/tx/${txHash}` : undefined;
}

function explorerBaseUrlForChain(chainId: number): string | undefined {
  if (chainId === 84532) return "https://sepolia.basescan.org";
  if (chainId === 8453) return "https://basescan.org";
  return undefined;
}
