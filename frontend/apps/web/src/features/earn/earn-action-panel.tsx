import * as React from "react";
import { useTranslations } from "next-intl";
import { AssetSelector, type AssetOption, type TxStepItem, type TxStatus } from "@ssot/ui";
import type { DomainError } from "@ssot/ssot";

import type { EarnTab } from "./types";

const TABS: Array<{ key: EarnTab; label: string; description: string }> = [
  {
    key: "deposit",
    label: "earn.actions.tabs.deposit.label",
    description: "earn.actions.tabs.deposit.description"
  },
  {
    key: "withdraw",
    label: "earn.actions.tabs.withdraw.label",
    description: "earn.actions.tabs.withdraw.description"
  },
  {
    key: "redeem",
    label: "earn.actions.tabs.redeem.label",
    description: "earn.actions.tabs.redeem.description"
  }
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
  availableLabel,
  availableValue,
  canUseMax,
  onUseMax,
  flow,
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
  availableLabel: string;
  availableValue: string;
  canUseMax: boolean;
  onUseMax: () => void;
  flow: EarnFlowState;
  onSubmit: () => void;
  connected: boolean;
}) {
  const t = useTranslations();
  const activeTab = TABS.find((item) => item.key === tab);

  return (
    <section className="rounded-md border border-border bg-surface-1 shadow-e2">
      <div className="border-b border-border p-5">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-fg-subtle">
          {t("earn.actions.eyebrow")}
        </div>
        <h2 className="mt-2 text-2xl font-bold text-fg">{t("earn.actions.title")}</h2>
      </div>

      <div className="grid gap-5 p-5">
        <div className="grid grid-cols-3 gap-2 rounded-md border border-border bg-surface-0 p-1">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onTabChange(item.key)}
              className={`rounded-sm px-3 py-3 text-xs font-bold uppercase tracking-[0.12em] transition ${
                tab === item.key
                  ? "bg-brand text-fg-inverse"
                  : "text-fg-muted hover:bg-surface-2 hover:text-fg"
              }`}
            >
              {t(item.label)}
            </button>
          ))}
        </div>

        <p className="text-sm leading-6 text-fg-muted">
          {activeTab ? t(activeTab.description) : ""}
        </p>

        <AssetSelector
          title={t("earn.actions.asset")}
          assets={[...assets]}
          value={asset}
          onValueChange={onAssetChange}
          showAddress
          disabled={flow.busy}
          error={unsupportedAsset ? t("earn.errors.primaryAssetOnly") : undefined}
        />

        <div className="rounded-md border border-border bg-surface-0 p-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <label
              htmlFor="earn-amount"
              className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle"
            >
              {t("earn.actions.amount")}
            </label>
            <div className="min-w-0 text-right text-[10px] font-bold uppercase tracking-[0.12em]">
              <span className="block truncate text-fg-subtle" title={availableLabel}>
                {availableLabel}
              </span>
              <span className="mt-1 block truncate font-mono text-fg-muted" title={availableValue}>
                {availableValue}
              </span>
              <button
                type="button"
                onClick={onUseMax}
                disabled={!canUseMax}
                className="mt-1 text-brand disabled:text-fg-subtle"
              >
                {t("earn.actions.balance.useMax")}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              id="earn-amount"
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="w-full bg-transparent font-mono text-3xl font-bold text-fg outline-none placeholder:text-fg-subtle"
            />
            <span className="text-sm font-bold uppercase tracking-[0.12em] text-fg-muted">
              {tab === "redeem" ? t("earn.units.shares") : symbol}
            </span>
          </div>
        </div>

        {!connected ? (
          <div className="rounded-md border border-dashed border-border bg-surface-0 p-5 text-sm text-fg-muted">
            {t("earn.actions.connectWallet")}
          </div>
        ) : null}

        {readOnly ? (
          <div className="rounded-md border border-warn/30 bg-warn/10 p-3 text-sm text-warn">
            {t("earn.actions.readOnly")}
          </div>
        ) : null}

        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          className="rounded-md bg-brand px-5 py-4 text-sm font-bold uppercase tracking-[0.12em] text-fg-inverse shadow-glow transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {flow.busy
            ? t("earn.actions.submit.executing")
            : tab === "deposit"
              ? t("earn.actions.submit.deposit")
              : tab === "withdraw"
                ? t("earn.actions.submit.withdraw")
                : t("earn.actions.submit.redeem")}
        </button>
      </div>
    </section>
  );
}
