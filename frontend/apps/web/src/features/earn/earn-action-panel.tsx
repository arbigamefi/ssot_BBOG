import * as React from "react";
import { AssetSelector, type AssetOption, type TxStepItem, type TxStatus } from "@ssot/ui";
import type { DomainError } from "@ssot/ssot";

import { EarnActionTrace } from "./earn-action-trace";
import type { EarnTab } from "./types";

const TABS: Array<{ key: EarnTab; label: string; description: string }> = [
  { key: "deposit", label: "Deposit", description: "Supply assets to the bank." },
  { key: "withdraw", label: "Withdraw", description: "Withdraw available assets." },
  { key: "redeem", label: "Redeem", description: "Redeem bank shares for assets." }
];

export type EarnFlowState = {
  status: TxStatus;
  steps: readonly TxStepItem[];
  hasActivity: boolean;
  busy: boolean;
  error?: DomainError;
  txHash?: string;
  blockNumber?: number;
  reset: () => void;
};

export function EarnActionPanel({
  tab,
  onTabChange,
  assets,
  asset,
  onAssetChange,
  amount,
  onAmountChange,
  symbol,
  disabled,
  readOnly,
  unsupportedAsset,
  formError,
  maxLabel,
  onUseMax,
  flow,
  explorerBaseUrl,
  onSubmit,
  connected
}: {
  tab: EarnTab;
  onTabChange: (tab: EarnTab) => void;
  assets: readonly AssetOption[];
  asset: `0x${string}`;
  onAssetChange: (asset: `0x${string}`) => void;
  amount: string;
  onAmountChange: (amount: string) => void;
  symbol: string;
  disabled: boolean;
  readOnly: boolean;
  unsupportedAsset: boolean;
  formError?: string;
  maxLabel: string;
  onUseMax: () => void;
  flow: EarnFlowState;
  explorerBaseUrl?: string;
  onSubmit: () => void;
  connected: boolean;
}) {
  return (
    <section className="rounded-md border border-border bg-surface-1 shadow-e2">
      <div className="border-b border-border p-5">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
          LP actions
        </div>
        <h2 className="mt-2 text-2xl font-black text-fg">Bank transaction console</h2>
      </div>

      <div className="grid gap-5 p-5">
        <div className="grid grid-cols-3 gap-2 rounded-md border border-border bg-surface-0 p-1">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onTabChange(item.key)}
              className={`rounded-sm px-3 py-3 text-xs font-black uppercase tracking-[0.12em] transition ${
                tab === item.key
                  ? "bg-brand text-fg-inverse"
                  : "text-fg-muted hover:bg-surface-2 hover:text-fg"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <p className="text-sm leading-6 text-fg-muted">
          {TABS.find((item) => item.key === tab)?.description}
        </p>

        <AssetSelector
          title="Asset"
          assets={[...assets]}
          value={asset}
          onValueChange={onAssetChange}
          showAddress
          disabled={flow.busy}
          error={
            unsupportedAsset ? "Write flows currently support only the primary asset." : undefined
          }
        />

        <div className="rounded-md border border-border bg-surface-0 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <label
              htmlFor="earn-amount"
              className="text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle"
            >
              Amount
            </label>
            <button
              type="button"
              onClick={onUseMax}
              disabled={tab === "deposit" || flow.busy}
              className="text-[10px] font-black uppercase tracking-[0.12em] text-brand disabled:text-fg-subtle"
            >
              {maxLabel}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <input
              id="earn-amount"
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="w-full bg-transparent font-mono text-3xl font-black text-fg outline-none placeholder:text-fg-subtle"
            />
            <span className="text-sm font-black uppercase tracking-[0.12em] text-fg-muted">
              {tab === "redeem" ? "Shares" : symbol}
            </span>
          </div>
        </div>

        {formError ? (
          <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {formError}
          </div>
        ) : null}

        {!connected ? (
          <div className="rounded-md border border-dashed border-border bg-surface-0 p-5 text-sm text-fg-muted">
            Connect a wallet to run bank actions.
          </div>
        ) : null}

        {readOnly ? (
          <div className="rounded-md border border-warn/30 bg-warn/10 p-3 text-sm text-warn">
            Writes are disabled for this release.
          </div>
        ) : null}

        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          className="rounded-md bg-brand px-5 py-4 text-sm font-black uppercase tracking-[0.12em] text-fg-inverse shadow-glow transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {flow.busy
            ? "Executing"
            : tab === "deposit"
              ? "Deposit assets"
              : tab === "withdraw"
                ? "Withdraw assets"
                : "Redeem shares"}
        </button>

        <EarnActionTrace
          title={
            tab === "deposit"
              ? "Deposit trace"
              : tab === "withdraw"
                ? "Withdraw trace"
                : "Redeem trace"
          }
          status={flow.status}
          steps={flow.steps}
          hasActivity={flow.hasActivity}
          error={flow.error}
          txHash={flow.txHash}
          blockNumber={flow.blockNumber}
          explorerBaseUrl={explorerBaseUrl}
          onReset={flow.reset}
        />
      </div>
    </section>
  );
}
