import * as React from "react";

import { formatUnits } from "../../betting/model/units";
import { formatTokenAmount } from "./format";
import { ClaimsActionTrace } from "./claims-action-trace";
import type { ClaimsAction, ClaimsFlowState } from "./types";

const ACTIONS: Array<{ key: ClaimsAction; label: string; detail: string }> = [
  { key: "claim", label: "Claim XP", detail: "Extract accrued XP to your wallet." },
  { key: "sync", label: "Sync", detail: "Move releasable holdback into the current XP ledger." },
  { key: "fees", label: "Fees", detail: "Governance-only protocol fee claim surface." }
];

export function ClaimsActionPanel({
  action,
  onActionChange,
  xpAmount,
  onXPAmountChange,
  feeAmount,
  onFeeAmountChange,
  symbol,
  decimals,
  claimable,
  feeClaimable,
  holdback,
  connected,
  readOnly,
  flow,
  explorerBaseUrl,
  onClaimXP,
  onSyncHoldback,
  onClaimFees
}: {
  action: ClaimsAction;
  onActionChange: (action: ClaimsAction) => void;
  xpAmount: string;
  onXPAmountChange: (amount: string) => void;
  feeAmount: string;
  onFeeAmountChange: (amount: string) => void;
  symbol: string;
  decimals: number;
  claimable?: bigint;
  feeClaimable?: bigint;
  holdback?: bigint;
  connected: boolean;
  readOnly: boolean;
  flow: ClaimsFlowState;
  explorerBaseUrl?: string;
  onClaimXP: () => void;
  onSyncHoldback: () => void;
  onClaimFees: () => void;
}) {
  const disabled = readOnly || !connected || flow.busy;
  const actionTitle =
    action === "claim"
      ? "Claim trace"
      : action === "sync"
        ? "Holdback sync trace"
        : "Fee claim trace";

  return (
    <section className="rounded-md border border-border bg-surface-1 shadow-e2">
      <div className="border-b border-border p-5">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
          Execution
        </div>
        <h2 className="mt-2 text-2xl font-black text-fg">Claims transaction console</h2>
      </div>

      <div className="grid gap-5 p-5">
        <div className="grid grid-cols-3 gap-2 rounded-md border border-border bg-surface-0 p-1">
          {ACTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onActionChange(item.key)}
              className={`rounded-sm px-3 py-3 text-xs font-black uppercase tracking-[0.12em] transition ${
                action === item.key
                  ? "bg-brand text-fg-inverse"
                  : "text-fg-muted hover:bg-surface-2 hover:text-fg"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <p className="text-sm leading-6 text-fg-muted">
          {ACTIONS.find((item) => item.key === action)?.detail}
        </p>

        {action === "claim" ? (
          <AmountBox
            label="Claim amount"
            value={xpAmount}
            onChange={onXPAmountChange}
            symbol={symbol}
            maxLabel={`Max ${formatTokenAmount(claimable, decimals, symbol, 2)}`}
            onUseMax={() =>
              onXPAmountChange(claimable == null ? "" : formatUnits(claimable, decimals))
            }
          />
        ) : null}

        {action === "sync" ? (
          <div className="rounded-md border border-border bg-surface-0 p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle">
              Holdback pending
            </div>
            <div className="mt-3 font-mono text-3xl font-black text-fg">
              {formatTokenAmount(holdback, decimals, symbol)}
            </div>
            <p className="mt-2 text-sm leading-6 text-fg-muted">
              Syncing updates the XP ledger based on the current on-chain holdback state.
            </p>
          </div>
        ) : null}

        {action === "fees" ? (
          <AmountBox
            label="Fee amount"
            value={feeAmount}
            onChange={onFeeAmountChange}
            symbol={symbol}
            maxLabel={`Max ${formatTokenAmount(feeClaimable, decimals, symbol, 2)}`}
            onUseMax={() =>
              onFeeAmountChange(feeClaimable == null ? "" : formatUnits(feeClaimable, decimals))
            }
          />
        ) : null}

        {!connected ? (
          <div className="rounded-md border border-dashed border-border bg-surface-0 p-5 text-sm text-fg-muted">
            Connect a wallet to run claim actions.
          </div>
        ) : null}

        {readOnly ? (
          <div className="rounded-md border border-warn/30 bg-warn/10 p-3 text-sm text-warn">
            Writes are disabled for this release.
          </div>
        ) : null}

        <button
          type="button"
          onClick={
            action === "claim" ? onClaimXP : action === "sync" ? onSyncHoldback : onClaimFees
          }
          disabled={
            disabled || (action === "claim" && !xpAmount) || (action === "fees" && !feeAmount)
          }
          className="rounded-md bg-brand px-5 py-4 text-sm font-black uppercase tracking-[0.12em] text-fg-inverse shadow-glow transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {flow.busy
            ? "Executing"
            : action === "claim"
              ? "Claim XP"
              : action === "sync"
                ? "Sync holdback"
                : "Claim protocol fees"}
        </button>

        <ClaimsActionTrace title={actionTitle} flow={flow} explorerBaseUrl={explorerBaseUrl} />
      </div>
    </section>
  );
}

function AmountBox({
  label,
  value,
  onChange,
  symbol,
  maxLabel,
  onUseMax
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  symbol: string;
  maxLabel: string;
  onUseMax: () => void;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-0 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle">
          {label}
        </label>
        <button
          type="button"
          onClick={onUseMax}
          className="text-[10px] font-black uppercase tracking-[0.12em] text-brand"
        >
          {maxLabel}
        </button>
      </div>
      <div className="flex items-center gap-3">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          className="w-full bg-transparent font-mono text-3xl font-black text-fg outline-none placeholder:text-fg-subtle"
        />
        <span className="text-sm font-black uppercase tracking-[0.12em] text-fg-muted">
          {symbol}
        </span>
      </div>
    </div>
  );
}
