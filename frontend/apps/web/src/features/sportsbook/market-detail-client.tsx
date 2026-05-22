"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SportsTicketRow } from "@ssot/bet-index";
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
import { providerOutcomeById, type SportsbookProviderOdds } from "./provider-odds";
import { useBetSlip, type BetSlipReceipt } from "./useBetSlip";
import {
  mergeSportsTicketRows,
  playerSportsTicketsQueryKey,
  usePlayerSportsTickets
} from "./usePlayerSportsTickets";
import { useSportsbookProviderOdds } from "./use-provider-odds";
import { useSportsRound, type SportsRoundState } from "./useSportsRound";

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
  const queryClient = useQueryClient();
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
  const providerOdds = providerOddsQuery.data ?? undefined;
  const playerTickets = usePlayerSportsTickets({
    enabled: Boolean(sdk?.account && parsedMarketId !== undefined),
    errorMessage: t("myTickets.error"),
    limit: 50,
    player: sdk?.account
  });
  const poolAsset = readback
    ? getPoolAsset(release, readback.market.poolId)
    : { symbol: "UNIT", decimals: 18 };
  const playerMarketTickets = React.useMemo(() => {
    const currentMarketId = readback?.market.marketId.toString();
    if (!currentMarketId) return [];
    return playerTickets.data.filter((row) => row.marketId === currentMarketId).slice(0, 8);
  }, [playerTickets.data, readback?.market.marketId]);

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
    onPlaced: (receipt) => {
      if (sdk?.account && receipt.ticketId && receipt.txHash) {
        queryClient.setQueryData<SportsTicketRow[]>(
          playerSportsTicketsQueryKey({ chainId, limit: 50, player: sdk.account }),
          (rows) => mergeSportsTicketRows(rows, buildOptimisticSportsTicketRow(chainId, receipt))
        );
      }
      void refetch();
      playerTickets.refetch();
    }
  });
  const latestTicketRow = React.useMemo(() => {
    const ticketId = slip.receipt?.ticketId?.toString();
    if (!ticketId) return undefined;
    return playerMarketTickets.find((row) => row.ticketId === ticketId);
  }, [playerMarketTickets, slip.receipt?.ticketId]);
  const round = useSportsRound({
    error: slip.error,
    receipt: slip.receipt,
    slipState: slip.state,
    ticket: latestTicketRow
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

        {slip.receipt?.ticketId ? (
          <LatestTicketTracker
            decimals={poolAsset.decimals}
            receipt={slip.receipt}
            round={round}
            symbol={poolAsset.symbol}
            txHash={slip.receipt.txHash}
          />
        ) : null}

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

            <PlayerMarketTicketsPanel
              connected={Boolean(sdk?.account)}
              decimals={poolAsset.decimals}
              error={playerTickets.error}
              isFetching={playerTickets.isFetching}
              isLoading={playerTickets.isLoading}
              odds={providerOdds}
              outcomeCount={readback.market.outcomeCount}
              result={readback.result}
              rows={playerMarketTickets}
              symbol={poolAsset.symbol}
            />

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

function LatestTicketTracker({
  decimals,
  receipt,
  round,
  symbol,
  txHash
}: {
  decimals: number;
  receipt: BetSlipReceipt;
  round: SportsRoundState;
  symbol: string;
  txHash?: string;
}) {
  const t = useTranslations("sportsbook.player.detail.latestTicket");
  return (
    <section className="rounded-lg border border-success/30 bg-success-soft p-4 md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-success">
            {t("eyebrow")}
          </div>
          <h2 className="mt-2 text-xl font-semibold text-fg">
            {t("title", { ticketId: receipt.ticketId?.toString() ?? "—" })}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-muted">
            {t(`stage.${round.kind}`)}
          </p>
        </div>
        <Link
          href={`/portfolio/tickets/${receipt.ticketId?.toString()}${txHash ? `?tx=${encodeURIComponent(txHash)}` : ""}`}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-fg-inverse transition-colors hover:bg-brand-hover"
        >
          {t("viewTicket")}
        </Link>
      </div>
      <dl className="mt-4 grid gap-3 md:grid-cols-3">
        <Cell label={t("pick")} value={receipt.outcomeName ?? "—"} />
        <Cell label={t("price")} value={receipt.decimalPrice ?? "—"} mono />
        <Cell
          label={t("potentialPayout")}
          value={
            receipt.payout ? formatTokenAmount(receipt.payout, decimals, symbol) : `— ${symbol}`
          }
          mono
        />
      </dl>
    </section>
  );
}

function buildOptimisticSportsTicketRow(chainId: number, receipt: BetSlipReceipt): SportsTicketRow {
  const ticketId = receipt.ticketId?.toString() ?? "0";
  const txHash = (receipt.txHash ?? "0x0") as SportsTicketRow["lastTxHash"];
  return {
    chainId,
    eventId: receipt.eventId?.toString(),
    id: `${chainId}:sports:${ticketId}`,
    lastEventName: "TicketPlaced",
    lastTxHash: txHash,
    marketId: receipt.marketId?.toString(),
    outcomeId: receipt.outcomeId,
    payout: receipt.payout,
    player: receipt.player as SportsTicketRow["player"],
    poolId: receipt.poolId?.toString(),
    stake: receipt.stake,
    state: "held",
    ticketId,
    updatedAt: Date.now(),
    updatedBlock: Number.MAX_SAFE_INTEGER
  };
}

function PlayerMarketTicketsPanel({
  connected,
  decimals,
  error,
  isFetching,
  isLoading,
  odds,
  outcomeCount,
  result,
  rows,
  symbol
}: {
  connected: boolean;
  decimals: number;
  error: unknown;
  isFetching: boolean;
  isLoading: boolean;
  odds?: SportsbookProviderOdds;
  outcomeCount: number;
  result?: DomainSportsResult;
  rows: SportsTicketRow[];
  symbol: string;
}) {
  const t = useTranslations("sportsbook.player.detail.myTickets");

  return (
    <section className="rounded-lg border border-border bg-surface-1 p-4 md:p-5">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-fg-subtle">
            {t("title")}
          </h2>
          <p className="mt-1 text-xs leading-5 text-fg-muted">{t("description")}</p>
        </div>
        {isFetching ? (
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-brand">
            {t("refreshing")}
          </span>
        ) : null}
      </header>

      {!connected ? (
        <EmptyTicketsMessage>{t("connect")}</EmptyTicketsMessage>
      ) : error ? (
        <EmptyTicketsMessage tone="danger">{t("error")}</EmptyTicketsMessage>
      ) : isLoading ? (
        <EmptyTicketsMessage>{t("loading")}</EmptyTicketsMessage>
      ) : rows.length === 0 ? (
        <EmptyTicketsMessage>{t("empty")}</EmptyTicketsMessage>
      ) : (
        <div className="overflow-hidden rounded-md border border-border-soft">
          <div className="hidden grid-cols-[88px_minmax(0,1fr)_120px_120px_96px] gap-3 border-b border-border-soft bg-surface-2/70 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-fg-subtle md:grid">
            <span>{t("columns.ticket")}</span>
            <span>{t("columns.pick")}</span>
            <span>{t("columns.stake")}</span>
            <span>{t("columns.payout")}</span>
            <span>{t("columns.status")}</span>
          </div>
          <div className="divide-y divide-border-soft">
            {rows.map((row) => {
              const status = describeTicketRowStatus(row, result, t);
              return (
                <Link
                  key={row.id}
                  href={`/portfolio/tickets/${row.ticketId}`}
                  className="grid gap-2 bg-surface-1 px-3 py-3 transition-colors hover:bg-surface-2 md:grid-cols-[88px_minmax(0,1fr)_120px_120px_96px] md:items-center md:gap-3"
                >
                  <span className="font-mono text-sm font-semibold text-fg">
                    {t("ticketNumber", { ticketId: row.ticketId })}
                  </span>
                  <span className="min-w-0 text-sm text-fg">
                    {describeTicketOutcome(row, odds, outcomeCount, t)}
                  </span>
                  <span className="font-mono text-sm tabular-nums text-fg-muted">
                    {formatTokenAmount(row.stake, decimals, symbol)}
                  </span>
                  <span className="font-mono text-sm tabular-nums text-fg-muted">
                    {formatTicketPayout(row, decimals, symbol, t)}
                  </span>
                  <span
                    className={`w-fit rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${status.className}`}
                  >
                    {status.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function EmptyTicketsMessage({
  children,
  tone = "neutral"
}: {
  children: React.ReactNode;
  tone?: "neutral" | "danger";
}) {
  const className =
    tone === "danger"
      ? "border-danger/25 bg-danger-soft text-danger"
      : "border-border-soft bg-surface-2/60 text-fg-muted";
  return <p className={`rounded-md border px-3 py-3 text-sm leading-6 ${className}`}>{children}</p>;
}

function describeTicketOutcome(
  row: SportsTicketRow,
  odds: SportsbookProviderOdds | undefined,
  outcomeCount: number,
  t: ReturnType<typeof useTranslations>
) {
  if (row.outcomeId === undefined) return t("unknownOutcome");
  const provider = providerOutcomeById(odds, row.outcomeId);
  if (provider) return provider.name;
  if (outcomeCount === 2) return row.outcomeId === 0 ? t("binaryYes") : t("binaryNo");
  if (outcomeCount === 3) {
    if (row.outcomeId === 0) return t("home");
    if (row.outcomeId === 1) return t("draw");
    if (row.outcomeId === 2) return t("away");
  }
  return t("outcomeFallback", { outcomeId: row.outcomeId + 1 });
}

function describeTicketRowStatus(
  row: SportsTicketRow,
  result: DomainSportsResult | undefined,
  t: ReturnType<typeof useTranslations>
) {
  const success = "bg-success-soft text-success ring-1 ring-inset ring-success/25";
  const danger = "bg-danger-soft text-danger ring-1 ring-inset ring-danger/25";
  const warn = "bg-warn-soft text-warn ring-1 ring-inset ring-warn/25";
  const neutral = "bg-surface-3 text-fg-subtle ring-1 ring-inset ring-border";

  if (row.state === "held") return { label: t("status.open"), className: neutral };
  if (row.state === "refunded" || row.state === "voided") {
    return { label: t("status.refunded"), className: warn };
  }
  if (row.state === "settled") {
    const won =
      result?.proposedAt && row.outcomeId !== undefined
        ? Number(result.winningOutcomeId) === row.outcomeId
        : BigInt(row.payout ?? "0") > 0n;
    return won
      ? { label: t("status.won"), className: success }
      : { label: t("status.lost"), className: danger };
  }
  return { label: t("status.open"), className: neutral };
}

function formatTicketPayout(
  row: SportsTicketRow,
  decimals: number,
  symbol: string,
  t: ReturnType<typeof useTranslations>
) {
  if (row.state === "held") {
    return row.payout ? formatTokenAmount(row.payout, decimals, symbol) : t("pending");
  }
  if (row.state === "settled") return formatTokenAmount(row.payout, decimals, symbol);
  if (row.state === "refunded" || row.state === "voided") {
    return formatTokenAmount(row.refundAmount ?? row.payout, decimals, symbol);
  }
  return t("pending");
}

function formatTokenAmount(value: string | undefined, decimals: number, symbol: string) {
  if (!value) return `— ${symbol}`;
  try {
    const raw = BigInt(value);
    const scale = 10n ** BigInt(decimals);
    const whole = raw / scale;
    const fraction = raw % scale;
    const fractionText = fraction.toString().padStart(decimals, "0").replace(/0+$/, "").slice(0, 6);
    return `${whole.toLocaleString("en-US")}${fractionText ? `.${fractionText}` : ""} ${symbol}`;
  } catch {
    return `${value} ${symbol}`;
  }
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
          <span className="text-fg-subtle">{t("rows.marketId")}</span>
          <span className="font-mono text-fg">{marketId}</span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border-soft bg-surface-2/60 px-3 py-2">
          <span className="text-fg-subtle">{t("rows.marketKey")}</span>
          <span className="font-mono text-fg">{marketKey}</span>
        </div>
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
      <div className="grid animate-pulse gap-3 rounded-lg border border-border bg-surface-1 p-5">
        <div className="h-4 w-32 rounded bg-surface-2" />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="h-24 rounded-md bg-surface-2" />
          <div className="h-24 rounded-md bg-surface-2" />
          <div className="h-24 rounded-md bg-surface-2" />
        </div>
        <div className="h-16 rounded-md bg-surface-2/70" />
      </div>
      <div className="grid animate-pulse gap-4 rounded-lg border border-border bg-surface-1 p-5">
        <div className="h-4 w-24 rounded bg-surface-2" />
        <div className="h-16 rounded-md bg-surface-2" />
        <div className="h-12 rounded-md bg-surface-2" />
        <div className="h-12 rounded-md bg-brand/30" />
      </div>
    </div>
  );
}
