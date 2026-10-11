"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";

import { getExplorerTxUrl } from "../../app-shell/chain-registry";
import { formatLocalDateTime } from "../../i18n/format";
import { useRelease } from "../../ssot/release/ReleaseProvider";
import { GovernanceCallLine } from "../governance/governance-queue-panel";
import type { GovernanceOperationState, GovernanceOperationView } from "../governance/types";
import { groupOperations, useOpsGovernance } from "../governance/useGovernance";
import { shortHex, toneBadgeClass } from "./format";
import type { OpsStatusTone } from "./types";

const STATE_TONE: Record<GovernanceOperationState, OpsStatusTone> = {
  waiting: "default",
  ready: "warn",
  executed: "success",
  cancelled: "danger"
};

/** The operator's view of governance and risk decisions: the whole timelock history, void windows and disabled games. */
export function OpsGovernancePanel() {
  const t = useTranslations("ops.governance");
  const locale = useLocale();
  const { release, chainId } = useRelease();
  const ops = useOpsGovernance();
  const data = ops.data;
  const unavailable = ops.isError || data?.source === "unavailable";
  const groups = data && !unavailable ? groupOperations(data.operations).reverse() : [];
  const time = (unixSeconds: number) => formatLocalDateTime(unixSeconds, locale);
  const txLink = (hash: string | undefined, label: string) => {
    const href = getExplorerTxUrl(chainId, hash);
    return hash ? (
      href ? (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-brand hover:text-brand-hover"
        >
          {label} {shortHex(hash)}
        </a>
      ) : (
        <span key={label} className="font-mono text-xs text-fg-muted">
          {label} {shortHex(hash)}
        </span>
      )
    ) : null;
  };
  const gameLabel = (gameId: string) =>
    release?.gamesMeta?.find((game) => game.gameId.toLowerCase() === gameId.toLowerCase())?.label ??
    shortHex(gameId);
  const stateOf = (operation: GovernanceOperationView): GovernanceOperationState =>
    operation.state === "waiting" && operation.readyAt * 1000 <= Date.now()
      ? "ready"
      : operation.state;

  return (
    <section
      className="rounded-md border border-border bg-surface-1 shadow-e2"
      data-testid="ops-governance"
    >
      <div className="border-b border-border p-5">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
          {t("eyebrow")}
        </div>
        <h2 className="mt-2 text-2xl font-black text-fg">{t("title")}</h2>
        <p className="mt-2 text-sm leading-6 text-fg-muted">{t("description")}</p>
        {data && !unavailable ? (
          <p className="mt-2 font-mono text-xs text-fg-subtle">
            {t("timelock", { address: shortHex(data.timelock) })}
            {" · "}
            {data.coverage.indexedThroughBlock != null && data.coverage.indexedThroughAt != null
              ? t("indexedThrough", {
                  block: data.coverage.indexedThroughBlock,
                  time: time(data.coverage.indexedThroughAt / 1000)
                })
              : t("notIndexed")}
          </p>
        ) : null}
      </div>

      {ops.isPending ? (
        <p role="status" className="p-5 text-sm text-fg-muted">
          {t("loading")}
        </p>
      ) : unavailable ? (
        <p role="alert" className="p-5 text-sm text-warn">
          {t("unavailable")}
        </p>
      ) : (
        <div className="grid gap-6 p-5">
          {data?.coverage.stale ? (
            <p role="status" className="text-sm text-warn">
              {t("stale")}
            </p>
          ) : null}

          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-fg-subtle">
              {t("operations.title")}
            </h3>
            {groups.length === 0 ? (
              <p className="mt-2 text-sm text-fg-muted">{t("operations.empty")}</p>
            ) : (
              <ul className="mt-3 grid gap-3">
                {groups.map((group) => {
                  const first = group.calls[0]!;
                  const state = stateOf(first);
                  return (
                    <li
                      key={group.operationId}
                      className="rounded-md border border-border-soft bg-surface-0 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`inline-flex rounded-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${toneBadgeClass(STATE_TONE[state])}`}
                        >
                          {t(`operations.states.${state}`)}
                        </span>
                        <span className="text-xs text-fg-muted">
                          {t("operations.readyAt", { time: time(first.readyAt) })}
                        </span>
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
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                        {txLink(first.scheduledTxHash, t("operations.scheduledTx"))}
                        {txLink(first.executedTxHash, t("operations.executedTx"))}
                        {txLink(first.cancelledTxHash, t("operations.cancelledTx"))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-fg-subtle">
              {t("voidWindows.title")}
            </h3>
            {data?.voidWindows.length ? (
              <ul className="mt-3 grid gap-2">
                {data.voidWindows.map((window) => (
                  <li
                    key={`${window.txHash}:${window.poolId}`}
                    className="rounded-md border border-border-soft bg-surface-0 p-4 text-sm leading-6 text-fg"
                  >
                    <div>
                      {t("voidWindows.row", {
                        pool: window.poolId,
                        cohortEnd: time(window.cohortEnd),
                        caller: shortHex(window.caller)
                      })}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4">
                      {window.blockTimestamp ? (
                        <span className="text-xs text-fg-muted">
                          {time(window.blockTimestamp / 1000)}
                        </span>
                      ) : null}
                      {txLink(window.txHash, t("tx"))}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-fg-muted">{t("voidWindows.empty")}</p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-fg-subtle">
              {t("disabledGames.title")}
            </h3>
            {data?.disabledGames.length ? (
              <ul className="mt-3 grid gap-2">
                {data.disabledGames.map((game) => (
                  <li
                    key={`${game.txHash}:${game.gameId}`}
                    className="rounded-md border border-border-soft bg-surface-0 p-4 text-sm leading-6 text-fg"
                  >
                    <div>
                      {t("disabledGames.row", {
                        game: gameLabel(game.gameId),
                        caller: shortHex(game.caller)
                      })}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4">
                      {game.blockTimestamp ? (
                        <span className="text-xs text-fg-muted">
                          {time(game.blockTimestamp / 1000)}
                        </span>
                      ) : null}
                      {txLink(game.txHash, t("tx"))}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-fg-muted">{t("disabledGames.empty")}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
