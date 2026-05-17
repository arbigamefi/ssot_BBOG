import * as React from "react";
import { useTranslations } from "next-intl";
import { TxStatusChip } from "@ssot/ui";
import type { GameHubEventRow } from "@ssot/ssot/indexer";

import { formatTimestamp, shortHex } from "./format";
import { eventStatus } from "./lifecycle";

export function BetDetailTimeline({ timeline }: { timeline: readonly GameHubEventRow[] }) {
  const t = useTranslations();

  return (
    <section className="rounded-md border border-border bg-surface-1 shadow-e2">
      <div className="border-b border-border px-5 py-4">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
          {t("portfolio.activity.detail.timeline.eyebrow")}
        </div>
        <h2 className="mt-2 text-2xl font-black text-fg">
          {t("portfolio.activity.detail.timeline.title")}
        </h2>
      </div>

      <div className="hidden md:block">
        <div className="grid grid-cols-[1.2fr_1fr_0.8fr_0.8fr] border-b border-border bg-surface-2 px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-fg-subtle">
          <div>{t("portfolio.activity.detail.timeline.columns.timeTx")}</div>
          <div>{t("portfolio.activity.detail.timeline.columns.event")}</div>
          <div>{t("portfolio.activity.detail.timeline.columns.block")}</div>
          <div>{t("portfolio.activity.detail.timeline.columns.status")}</div>
        </div>
        <TimelineRows timeline={timeline} />
      </div>

      <div className="grid gap-3 p-4 md:hidden">
        {timeline.length > 0 ? (
          timeline.map((row) => <MobileEvent key={`${row.txHash}-${row.logIndex}`} row={row} />)
        ) : (
          <EmptyTimeline />
        )}
      </div>
    </section>
  );
}

function TimelineRows({ timeline }: { timeline: readonly GameHubEventRow[] }) {
  if (timeline.length === 0) {
    return <EmptyTimeline />;
  }

  return (
    <div>
      {timeline.map((row) => (
        <div
          key={`${row.txHash}-${row.logIndex}`}
          className="grid grid-cols-[1.2fr_1fr_0.8fr_0.8fr] items-center border-b border-border-soft px-5 py-4 text-sm last:border-b-0"
        >
          <div>
            <div className="font-bold text-fg">{formatTimestamp(row.createdAt)}</div>
            <div className="mt-1 font-mono text-xs text-fg-subtle">{shortHex(row.txHash)}</div>
          </div>
          <div className="font-bold text-fg-muted">{row.eventName}</div>
          <div className="font-mono text-fg-muted">{row.blockNumber}</div>
          <div>
            <TxStatusChip status={eventStatus(row.eventName)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MobileEvent({ row }: { row: GameHubEventRow }) {
  const t = useTranslations();

  return (
    <div className="rounded-md border border-border-soft bg-surface-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-bold text-fg">{row.eventName}</div>
          <div className="mt-1 font-mono text-xs text-fg-subtle">{shortHex(row.txHash)}</div>
        </div>
        <TxStatusChip status={eventStatus(row.eventName)} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
        <span className="text-fg-subtle">
          {t("portfolio.activity.detail.timeline.columns.block")}
        </span>
        <span className="font-mono text-fg-muted">{row.blockNumber}</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-sm">
        <span className="text-fg-subtle">
          {t("portfolio.activity.detail.timeline.mobile.time")}
        </span>
        <span className="font-mono text-fg-muted">{formatTimestamp(row.createdAt)}</span>
      </div>
    </div>
  );
}

function EmptyTimeline() {
  const t = useTranslations();

  return (
    <div className="p-5">
      <div className="rounded-md border border-dashed border-border bg-surface-0 py-12 text-center text-sm text-fg-muted">
        {t("portfolio.activity.detail.timeline.empty")}
      </div>
    </div>
  );
}
