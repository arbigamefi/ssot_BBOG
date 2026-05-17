"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import type { DomainSportsTicket } from "@ssot/ssot";
import type { SSOTSDK, TxResult } from "@ssot/ssot/sdk";
import { toast } from "@ssot/ui";

import { formatLookupError } from "./format";
import { DetailCell, TicketInspector } from "./components";

type TicketTerminalStatus = {
  busy: boolean;
  label: string;
  txHash?: string;
  error?: string;
};

function parseTicketIds(value: string, t: ReturnType<typeof useTranslations>) {
  const ids = value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!ids.length) throw new Error(t("sportsbook.ticketTerminal.validation.oneTicket"));
  return ids.map((item) => {
    if (!/^[0-9]+$/.test(item)) {
      throw new Error(t("sportsbook.ticketTerminal.validation.numeric"));
    }
    const parsed = BigInt(item);
    if (parsed <= 0n) throw new Error(t("sportsbook.ticketTerminal.validation.positive"));
    return parsed;
  });
}

export function SportsbookTicketTerminalPanel({
  sdk,
  disabled,
  disabledReason,
  defaultTicketId,
  onMutated
}: {
  sdk?: SSOTSDK;
  disabled: boolean;
  disabledReason?: string;
  defaultTicketId?: string;
  onMutated?: () => void;
}) {
  const t = useTranslations();
  const [ticketIds, setTicketIds] = React.useState(defaultTicketId ?? "");
  const [lookupId, setLookupId] = React.useState<bigint | undefined>();
  const [inputError, setInputError] = React.useState<string | undefined>();
  const [status, setStatus] = React.useState<TicketTerminalStatus>({
    busy: false,
    label: t("sportsbook.ticketTerminal.status.noAction")
  });

  const {
    data: ticket,
    error: ticketError,
    isFetching: ticketFetching,
    refetch: refetchTicket
  } = useQuery({
    queryKey: ["ssot", "sportsbook", "ticket-terminal", lookupId?.toString() ?? "none"],
    enabled: Boolean(sdk && lookupId !== undefined),
    staleTime: 10_000,
    queryFn: async (): Promise<DomainSportsTicket | undefined> => {
      if (!sdk || lookupId === undefined) return undefined;
      return sdk.sportsHub.getTicket(lookupId);
    }
  });

  const inspectTicket = React.useCallback(() => {
    try {
      const [firstTicketId] = parseTicketIds(ticketIds, t);
      setInputError(undefined);
      setLookupId(firstTicketId);
    } catch (error) {
      setInputError(formatLookupError(error));
    }
  }, [t, ticketIds]);

  async function run(label: string, action: (ids: readonly bigint[]) => Promise<TxResult>) {
    if (!sdk) return;
    try {
      const ids = parseTicketIds(ticketIds, t);
      setInputError(undefined);
      setStatus({ busy: true, label });
      const result = await action(ids);
      if (!result.ok) {
        const message =
          result.error?.message ?? t("sportsbook.ticketTerminal.status.actionFailed", { label });
        setStatus({ busy: false, label, error: message });
        toast.error(message);
        return;
      }
      setStatus({ busy: false, label, txHash: result.txHash });
      toast.success(t("sportsbook.ticketTerminal.status.actionSubmitted", { label }));
      onMutated?.();
      void refetchTicket();
    } catch (error) {
      const message =
        formatLookupError(error) ?? t("sportsbook.ticketTerminal.status.actionFailed", { label });
      setStatus({ busy: false, label, error: message });
      setInputError(message);
      toast.error(message);
    }
  }

  const actionDisabled = disabled || status.busy || !sdk?.account;

  const settleTickets = React.useCallback(() => {
    void run(t("sportsbook.ticketTerminal.actions.settleTickets"), async (ids) =>
      ids.length === 1 ? sdk!.sportsHub.settleTicket(ids[0]!) : sdk!.sportsHub.settleTickets(ids)
    );
  }, [sdk, t, ticketIds]);

  const refundTickets = React.useCallback(() => {
    void run(t("sportsbook.ticketTerminal.actions.refundTickets"), async (ids) =>
      ids.length === 1 ? sdk!.sportsHub.refundTicket(ids[0]!) : sdk!.sportsHub.refundTickets(ids)
    );
  }, [sdk, t, ticketIds]);

  const voidTickets = React.useCallback(() => {
    void run(t("sportsbook.ticketTerminal.actions.voidTickets"), async (ids) =>
      ids.length === 1 ? sdk!.sportsHub.voidTicket(ids[0]!) : sdk!.sportsHub.voidTickets(ids)
    );
  }, [sdk, t, ticketIds]);

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-3">
        <DetailCell
          label={t("sportsbook.ticketTerminal.summary.wallet")}
          value={
            sdk?.account
              ? t("sportsbook.ticketTerminal.summary.connected")
              : t("sportsbook.ticketTerminal.summary.required")
          }
          helper={disabledReason ?? t("sportsbook.ticketTerminal.summary.walletHelper")}
          mono={false}
        />
        <DetailCell
          label={t("sportsbook.ticketTerminal.summary.lastAction")}
          value={status.label}
          helper={status.error}
          mono={false}
        />
        <DetailCell
          label={t("sportsbook.ticketTerminal.summary.lastTx")}
          value={status.txHash ?? t("sportsbook.components.na")}
        />
      </div>

      <div className="rounded-lg border border-border bg-surface-2/70 p-5">
        <label
          htmlFor="sports-ticket-terminal-ids"
          className="text-xs font-bold uppercase tracking-[0.16em] text-fg-subtle"
        >
          {t("sportsbook.ticketTerminal.form.ticketIds")}
        </label>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row">
          <input
            id="sports-ticket-terminal-ids"
            value={ticketIds}
            onChange={(event) => setTicketIds(event.target.value)}
            placeholder="12 or 12,13,14"
            className="min-h-11 flex-1 rounded-md border border-border bg-surface-0 px-3 font-mono text-sm text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-brand"
          />
          <button
            type="button"
            onClick={inspectTicket}
            className="min-h-11 rounded-md border border-border bg-surface-2 px-4 text-sm font-black text-fg transition-colors hover:border-brand/40 hover:bg-surface-3"
          >
            {t("sportsbook.ticketTerminal.actions.inspectTicket")}
          </button>
          <button
            type="button"
            disabled={actionDisabled}
            onClick={settleTickets}
            className="min-h-11 rounded-md bg-brand px-4 text-sm font-black text-fg-inverse shadow-glow transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("sportsbook.ticketTerminal.actions.settle")}
          </button>
          <button
            type="button"
            disabled={actionDisabled}
            onClick={refundTickets}
            className="min-h-11 rounded-md border border-border bg-surface-2 px-4 text-sm font-black text-fg transition-colors hover:border-brand/40 hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("sportsbook.ticketTerminal.actions.refund")}
          </button>
          <button
            type="button"
            disabled={actionDisabled}
            onClick={voidTickets}
            className="min-h-11 rounded-md border border-danger/30 bg-danger-soft px-4 text-sm font-black text-danger transition-colors hover:border-danger/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("sportsbook.ticketTerminal.actions.void")}
          </button>
        </div>
        {inputError || ticketError ? (
          <div className="mt-3 text-xs leading-5 text-danger">
            {inputError ?? formatLookupError(ticketError)}
          </div>
        ) : null}
      </div>

      {ticketFetching && !ticket ? (
        <div className="rounded-lg border border-border bg-surface-2/50 p-4 text-sm leading-6 text-fg-muted">
          {t("sportsbook.ticketTerminal.loading")}
        </div>
      ) : ticket ? (
        <TicketInspector ticket={ticket} />
      ) : (
        <div className="rounded-lg border border-border bg-surface-2/50 p-4 text-sm leading-6 text-fg-muted">
          {t("sportsbook.ticketTerminal.empty")}
        </div>
      )}
    </div>
  );
}
