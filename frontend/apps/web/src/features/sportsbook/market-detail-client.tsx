"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { PageTransition } from "../../components/PageTransition";
import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../ssot/sdk";
import {
  DetailCell,
  MarketInspector,
  SectionShell,
  StatusPill,
  type MarketTapeRow
} from "./components";
import { formatLookupError, parseLookupId, shortHex } from "./format";
import { SportsbookTicketPlacementPanel } from "./ticket-placement-panel";
import { SportsbookTicketTerminalPanel } from "./ticket-terminal-panel";

interface MarketDetailReadback extends MarketTapeRow {
  eventReserved?: bigint;
  poolEventReserved?: bigint;
  outcomeReserved: Array<{ outcomeId: number; reserved?: bigint }>;
}

function formatUnits(value?: bigint) {
  return value === undefined ? "N/A" : value.toLocaleString("en-US");
}

export function SportsbookMarketDetailPageClient({ marketId }: { marketId: string }) {
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
    staleTime: 15_000,
    queryFn: async (): Promise<MarketDetailReadback | undefined> => {
      if (!sdk || parsedMarketId === undefined) return undefined;
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
    }
  });

  if (!release) {
    return (
      <PageTransition pageKey={`sports-market-${marketId}`}>
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

  return (
    <PageTransition pageKey={`sports-market-${marketId}`}>
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8 py-12 md:py-16">
        <header className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Link
              href="/sportsbook"
              className="text-sm font-semibold text-fg-muted transition-colors hover:text-fg"
            >
              Back to sportsbook
            </Link>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <StatusPill tone={sportsbook.enabled ? "success" : "warn"}>
                {sportsbook.enabled ? "Metadata enabled" : "Read-only preview"}
              </StatusPill>
              <StatusPill tone="neutral">Market detail</StatusPill>
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-fg md:text-5xl">
              Market {marketId}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-fg-muted md:text-[15px]">
              Direct SportsHub readback for one fixed-odds market. Ticket placement stays behind the
              frontend release gate and requires a complete signed odds snapshot before broadcast.
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
            eyebrow="Invalid route"
            title="Invalid market id"
            description="SportsHub market routes require a numeric market id."
          >
            <Link
              href="/sportsbook"
              className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-black text-fg-inverse shadow-glow transition-colors hover:bg-brand-hover"
            >
              Return to sportsbook
            </Link>
          </SectionShell>
        ) : error ? (
          <SectionShell
            eyebrow="Read failed"
            title="Market readback failed"
            description="The SDK could not read this SportsHub market from the active release."
          >
            <div className="rounded-lg border border-danger/25 bg-danger-soft p-4 text-sm leading-6 text-danger">
              {formatLookupError(error)}
            </div>
          </SectionShell>
        ) : isFetching && !readback ? (
          <SectionShell
            eyebrow="Readback"
            title="Loading market"
            description="Reading market, result, and exposure records through the v1.3 SDK."
          >
            <div className="rounded-lg border border-border bg-surface-2/50 p-4 text-sm leading-6 text-fg-muted">
              Loading SportsHub market state...
            </div>
          </SectionShell>
        ) : readback ? (
          <>
            <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
              <SectionShell
                eyebrow="Market"
                title="Lifecycle and result"
                description="Market state is read directly from SportsHub. Result state is displayed when a reporter proposal exists."
              >
                <MarketInspector
                  market={readback.market}
                  result={readback.result}
                  reserved={readback.reserved}
                />
              </SectionShell>

              <SectionShell
                eyebrow="Exposure"
                title="Reserved capital"
                description="These values are the on-chain exposure readback used by ops to validate market, outcome, event, and pool-event caps."
              >
                <div className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <DetailCell label="Market reserved" value={formatUnits(readback.reserved)} />
                    <DetailCell
                      label="Event reserved"
                      value={formatUnits(readback.eventReserved)}
                    />
                    <DetailCell
                      label="Pool-event reserved"
                      value={formatUnits(readback.poolEventReserved)}
                    />
                    <DetailCell
                      label="Outcome count"
                      value={readback.market.outcomeCount.toString()}
                    />
                  </div>

                  <div className="overflow-hidden rounded-lg border border-border">
                    <div className="border-b border-border bg-surface-2 px-4 py-3 text-sm font-semibold text-fg">
                      Outcome exposure
                    </div>
                    <div className="divide-y divide-border-soft">
                      {readback.outcomeReserved.map((row) => (
                        <div
                          key={row.outcomeId}
                          className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                        >
                          <div className="text-fg-muted">Outcome {row.outcomeId}</div>
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
              eyebrow="Ticket placement"
              title="Signed odds ticket"
              description="This is the only public risk-in path for the MVP: it plans ERC20 approval, validates the signed odds snapshot against the active market, then calls SportsHub.placeTicket through the SDK."
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
                        ? "Market must be open before ticket placement."
                        : "A connected wallet and signed odds snapshot are required."
                }
                onMutated={() => void refetchReadback()}
              />
            </SectionShell>

            <SectionShell
              eyebrow="Ticket terminalization"
              title="Settle, refund, or void tickets"
              description="Debt-out calls remain wallet-gated and use SportsHub terminal helpers. Inspect a ticket before broadcasting to verify the state and payout path."
            >
              <SportsbookTicketTerminalPanel
                sdk={sdk}
                disabled={readOnly || !ready}
                disabledReason={
                  readOnly
                    ? readOnlyReason
                    : "A connected wallet is required to broadcast terminal ticket calls."
                }
                onMutated={() => void refetchReadback()}
              />
            </SectionShell>
          </>
        ) : (
          <SectionShell
            eyebrow="Readback"
            title="No market data"
            description="No market was returned for this id from the active SportsHub."
          >
            <Link
              href="/sportsbook"
              className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-black text-fg-inverse shadow-glow transition-colors hover:bg-brand-hover"
            >
              Return to sportsbook
            </Link>
          </SectionShell>
        )}
      </div>
    </PageTransition>
  );
}
