"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { ClockIcon } from "@heroicons/react/24/outline";
import { cn } from "@ssot/ui";

import { getExplorerTxUrl } from "../../app-shell/chain-registry";
import { formatLocalDateTime } from "../../i18n/format";
import { useRelease } from "../../ssot/release/ReleaseProvider";
import { formatUnits } from "../betting/model/units";
import { describeGovernanceCall, shortAddress } from "./describe";
import type { GovernanceOperationView } from "./types";
import { groupOperations, useGovernanceQueue } from "./useGovernance";

/**
 * For LPs: every governance change waiting in the 72-hour timelock or ready to execute, so an LP who
 * disagrees can withdraw a mature deposit first (ADR-0037 §2, §3).
 */
export function GovernanceQueuePanel() {
  const t = useTranslations();
  const locale = useLocale();
  const { release, chainId } = useRelease();
  const queue = useGovernanceQueue();
  const data = queue.data;
  const unavailable = queue.isError || data?.source === "unavailable";
  const groups = data && !unavailable ? groupOperations(data.operations) : [];
  const now = Date.now();

  return (
    <section
      aria-labelledby="governance-queue-title"
      className="rounded-md border border-border bg-surface-1 shadow-e2"
      data-testid="governance-queue"
    >
      <div className="border-b border-border p-5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-fg-subtle">
          <ClockIcon className="h-4 w-4 text-brand" />
          {t("governance.queue.eyebrow")}
        </div>
        <h2 id="governance-queue-title" className="mt-2 text-2xl font-bold text-fg">
          {t("governance.queue.title")}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-fg-muted">
          {t("governance.queue.explainer")}
        </p>
      </div>
      <div className="grid gap-3 p-5">
        {queue.isPending ? (
          <p role="status" className="text-sm text-fg-muted">
            {t("governance.queue.loading")}
          </p>
        ) : unavailable ? (
          <p role="alert" className="text-sm text-warn">
            {t("governance.queue.unavailable")}
          </p>
        ) : (
          <>
            {data?.coverage.stale ? (
              <p role="status" className="text-sm text-warn">
                {data.coverage.indexedThroughAt
                  ? t("governance.queue.stale", {
                      time: formatLocalDateTime(data.coverage.indexedThroughAt / 1000, locale)
                    })
                  : t("governance.queue.staleUnknown")}
              </p>
            ) : null}
            {groups.length === 0 && !data?.coverage.stale ? (
              <p className="text-sm font-bold text-fg">{t("governance.queue.empty")}</p>
            ) : null}
            {groups.length > 0 ? (
              <ul className="grid gap-3">
                {groups.map((group) => {
                  const first = group.calls[0]!;
                  const ready = first.readyAt * 1000 <= now;
                  const txHref = getExplorerTxUrl(chainId, first.scheduledTxHash);
                  return (
                    <li
                      key={group.operationId}
                      className="rounded-md border border-border-soft bg-surface-0 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={cn(
                            "inline-flex rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]",
                            ready
                              ? "border-warn/30 bg-warn-soft text-warn"
                              : "border-border bg-surface-2 text-fg-muted"
                          )}
                        >
                          {ready
                            ? t("governance.queue.ready")
                            : t("governance.queue.executableFrom", {
                                time: formatLocalDateTime(first.readyAt, locale)
                              })}
                        </span>
                        {txHref ? (
                          <a
                            href={txHref}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-xs text-brand hover:text-brand-hover"
                          >
                            {t("governance.queue.scheduledTx", {
                              tx: shortAddress(first.scheduledTxHash)
                            })}
                          </a>
                        ) : null}
                      </div>
                      <ul className="mt-3 grid gap-2">
                        {group.calls.map((operation) => (
                          <GovernanceCallLine
                            key={`${operation.operationId}:${operation.index}`}
                            operation={operation}
                            release={release}
                            locale={locale}
                          />
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

export function GovernanceCallLine({
  operation,
  release,
  locale
}: {
  operation: GovernanceOperationView;
  release: ReturnType<typeof useRelease>["release"];
  locale: string;
}) {
  const t = useTranslations();
  const line = describeGovernanceCall(
    operation.call,
    {
      pools: release?.pools ?? [],
      assets: release?.assets ?? [],
      gamesMeta: release?.gamesMeta
    },
    locale,
    t
  );
  const value = BigInt(operation.value);
  return (
    <li className="flex flex-wrap items-start gap-2 text-sm leading-6 text-fg">
      {line.critical ? (
        <span className="inline-flex shrink-0 rounded-md border border-danger/30 bg-danger-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-danger">
          {t("governance.queue.critical")}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 break-words">
        {line.text}
        {value > 0n ? (
          <span className="text-fg-muted">
            {" "}
            {t("governance.queue.sendsValue", { amount: formatUnits(value, 18) })}
          </span>
        ) : null}
      </span>
    </li>
  );
}
