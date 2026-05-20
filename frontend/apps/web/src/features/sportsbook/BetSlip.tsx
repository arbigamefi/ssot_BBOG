"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import type { BetSlipController, BetSlipState } from "./useBetSlip";

const STAGE_KEY: Record<BetSlipState, string> = {
  idle: "stage.idle",
  ready: "stage.ready",
  fetchingOdds: "stage.fetchingOdds",
  planning: "stage.planning",
  signing: "stage.signing",
  mining: "stage.mining",
  placed: "stage.placed",
  error: "stage.error"
};

const ACTION_KEY: Record<BetSlipState, string> = {
  idle: "action.idle",
  ready: "action.ready",
  fetchingOdds: "action.busy",
  planning: "action.busy",
  signing: "action.busy",
  mining: "action.busy",
  placed: "action.placed",
  error: "action.retry"
};

/**
 * BetSlip — sticky right-rail (desktop) or pinned bottom (mobile) panel that
 * owns the entire "stake → place" flow. Replaces the previous operator-form
 * panel where the player had to step through "fetch odds → plan → place"
 * by hand.
 *
 * Inputs are minimal: outcome label (provided by the parent OutcomesBoard via
 * `selectedOutcome`) and stake amount. Everything else (signed odds, plan,
 * approve, execute) runs under the hood through the BetSlip controller.
 */
export function BetSlip({
  controller,
  symbol,
  decimals,
  selectedOutcome,
  isReadOnly,
  readOnlyReason,
  marketStateLabel
}: {
  controller: BetSlipController;
  symbol: string;
  decimals: number;
  selectedOutcome?: { label: string; price?: string };
  isReadOnly?: boolean;
  readOnlyReason?: string;
  marketStateLabel?: string;
}) {
  const t = useTranslations("sportsbook.player.slip");
  const stakeParsed = parseStake(controller.stake, decimals);
  const previewPayout = computePayout(stakeParsed, selectedOutcome?.price, decimals, symbol);

  return (
    <aside
      className="sticky top-24 flex flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5 shadow-e2"
      aria-label={t("ariaLabel")}
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-fg-subtle">
          {t("title")}
        </h2>
        {marketStateLabel ? (
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-fg-subtle">
            {marketStateLabel}
          </span>
        ) : null}
      </header>

      <section className="rounded-md border border-border bg-surface-2 p-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
          {t("selection")}
        </div>
        {selectedOutcome ? (
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <div className="truncate text-base font-semibold text-fg">{selectedOutcome.label}</div>
            <div className="font-mono text-base tabular-nums text-fg">
              {selectedOutcome.price ?? t("priceUnknown")}
            </div>
          </div>
        ) : (
          <div className="mt-2 text-sm text-fg-muted">{t("emptySelection")}</div>
        )}
      </section>

      <section>
        <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
          {t("stakeLabel", { symbol })}
        </label>
        <div className="mt-2 flex h-12 items-center gap-2 rounded-md border border-border bg-surface-2 px-3 focus-within:border-brand">
          <input
            type="text"
            inputMode="decimal"
            value={controller.stake}
            onChange={(e) => controller.setStake(e.target.value)}
            disabled={
              isReadOnly ||
              controller.state === "fetchingOdds" ||
              controller.state === "planning" ||
              controller.state === "signing" ||
              controller.state === "mining"
            }
            placeholder="0.00"
            className="h-10 w-full bg-transparent font-mono text-lg tabular-nums text-fg outline-none placeholder:text-fg-subtle"
            aria-label={t("stakeLabel", { symbol })}
          />
          <span className="text-sm font-medium text-fg-subtle">{symbol}</span>
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
            {t("stakeRow")}
          </dt>
          <dd className="mt-1 font-mono tabular-nums text-fg">
            {stakeParsed ? formatAmount(stakeParsed, decimals, symbol) : `— ${symbol}`}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
            {t("payoutRow")}
          </dt>
          <dd className="mt-1 font-mono tabular-nums text-fg">{previewPayout ?? `— ${symbol}`}</dd>
        </div>
      </dl>

      <div className="rounded-md border border-border-soft bg-surface-2/60 p-3">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
          {t("stageLabel")}
        </div>
        <div className="mt-1 text-sm font-medium text-fg">{t(STAGE_KEY[controller.state])}</div>
      </div>

      {controller.error ? (
        <div className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm leading-5 text-danger">
          {controller.error}
        </div>
      ) : null}

      {controller.state === "placed" && controller.receipt ? (
        <ReceiptSummary
          payout={controller.receipt.payout}
          symbol={symbol}
          decimals={decimals}
          ticketId={controller.receipt.ticketId}
          txHash={controller.receipt.txHash}
          onPlaceAnother={controller.reset}
        />
      ) : (
        <button
          type="button"
          onClick={() => void controller.submit()}
          disabled={
            !controller.canSubmit ||
            controller.state === "fetchingOdds" ||
            controller.state === "planning" ||
            controller.state === "signing" ||
            controller.state === "mining"
          }
          className="inline-flex h-12 w-full items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-fg-inverse transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-fg-subtle"
        >
          {t(ACTION_KEY[controller.state])}
        </button>
      )}

      {controller.blockedReason && controller.state !== "placed" ? (
        <p className="text-xs leading-5 text-fg-muted">{controller.blockedReason}</p>
      ) : isReadOnly && readOnlyReason ? (
        <p className="text-xs leading-5 text-fg-muted">{readOnlyReason}</p>
      ) : null}
    </aside>
  );
}

function ReceiptSummary({
  payout,
  symbol,
  decimals,
  ticketId,
  txHash,
  onPlaceAnother
}: {
  payout?: string;
  symbol: string;
  decimals: number;
  ticketId?: bigint;
  txHash?: string;
  onPlaceAnother: () => void;
}) {
  const t = useTranslations("sportsbook.player.slip.receipt");
  const payoutFormatted = payout ? formatAmount(BigInt(payout), decimals, symbol) : undefined;
  return (
    <section className="rounded-md border border-success/30 bg-success-soft p-4">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
        <h3 className="text-sm font-semibold text-success">{t("title")}</h3>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="font-medium uppercase tracking-[0.14em] text-fg-subtle">{t("payout")}</dt>
          <dd className="mt-1 font-mono tabular-nums text-fg">
            {payoutFormatted ?? `— ${symbol}`}
          </dd>
        </div>
        <div>
          <dt className="font-medium uppercase tracking-[0.14em] text-fg-subtle">
            {t("ticketId")}
          </dt>
          <dd className="mt-1 font-mono text-fg">{ticketId ? `#${ticketId.toString()}` : "—"}</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        {ticketId ? (
          <Link
            href={`/portfolio/tickets/${ticketId.toString()}${txHash ? `?tx=${encodeURIComponent(txHash)}` : ""}`}
            className="inline-flex h-9 items-center rounded-md border border-success/30 bg-surface-1 px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            {t("viewTicket")}
          </Link>
        ) : null}
        {txHash ? (
          <span className="inline-flex h-9 items-center rounded-md border border-border bg-surface-2 px-3 font-mono text-xs text-fg-muted">
            {shortHex(txHash)}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onPlaceAnother}
          className="ml-auto inline-flex h-9 items-center rounded-md border border-border bg-surface-2 px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-3"
        >
          {t("placeAnother")}
        </button>
      </div>
    </section>
  );
}

function parseStake(stake: string, decimals: number): bigint | undefined {
  const trimmed = stake.trim();
  if (!trimmed || !/^\d*\.?\d*$/.test(trimmed)) return undefined;
  const [whole = "0", fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) return undefined;
  try {
    return BigInt(whole + fraction.padEnd(decimals, "0"));
  } catch {
    return undefined;
  }
}

function formatAmount(value: bigint, decimals: number, symbol: string): string {
  if (value === 0n) return `0 ${symbol}`;
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const fraction = abs % base;
  const fractionStr = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  const numeric = fractionStr ? `${whole.toString()}.${fractionStr}` : whole.toString();
  return `${negative ? "-" : ""}${numeric} ${symbol}`;
}

function computePayout(
  stake: bigint | undefined,
  price: string | undefined,
  decimals: number,
  symbol: string
): string | undefined {
  if (!stake || !price) return undefined;
  const decimalPrice = Number(price);
  if (!Number.isFinite(decimalPrice) || decimalPrice <= 0) return undefined;
  const stakeNumber = Number(stake);
  if (!Number.isFinite(stakeNumber)) return undefined;
  const payout = Math.floor(stakeNumber * decimalPrice);
  return `≈ ${formatAmount(BigInt(payout), decimals, symbol)}`;
}

function shortHex(value: string): string {
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}
