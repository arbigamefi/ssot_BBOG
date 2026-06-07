import * as React from "react";
import { useTranslations } from "next-intl";
import { AssetSelector, type AssetOption, type TxStepItem, type TxStatus } from "@ssot/ui";
import type { DomainError } from "@ssot/ssot";

import { TokenLogo } from "../../components/TokenLogo";
import type { EarnAmountMode, EarnTab } from "./types";

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
  }
];

const AMOUNT_MODES: Array<{ key: EarnAmountMode; label: string }> = [
  { key: "assets", label: "earn.actions.amountMode.assets" },
  { key: "shares", label: "earn.actions.amountMode.shares" }
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
  amountMode,
  onAmountModeChange,
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
  amountMode: EarnAmountMode;
  onAmountModeChange: (mode: EarnAmountMode) => void;
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
    <section
      aria-labelledby="earn-actions-title"
      className="min-w-0 rounded-md border border-border bg-surface-1 shadow-e2"
    >
      <div className="border-b border-border p-4 sm:p-5">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-fg-subtle">
          {t("earn.actions.eyebrow")}
        </div>
        <h2 id="earn-actions-title" className="mt-2 text-2xl font-bold text-fg">
          {t("earn.actions.title")}
        </h2>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 p-4 sm:gap-5 sm:p-5">
        <div className="grid min-w-0 grid-cols-2 gap-2 rounded-md border border-border bg-surface-0 p-1">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onTabChange(item.key)}
              className={`min-w-0 rounded-sm px-2 py-3 text-[11px] font-bold uppercase tracking-[0.08em] transition sm:px-3 sm:text-xs sm:tracking-[0.12em] ${
                tab === item.key
                  ? "bg-brand text-fg-inverse"
                  : "text-fg-muted hover:bg-surface-2 hover:text-fg"
              }`}
            >
              <span className="block truncate">{t(item.label)}</span>
            </button>
          ))}
        </div>

        <p className="min-w-0 text-sm leading-6 text-fg-muted">
          {activeTab ? t(activeTab.description) : ""}
        </p>

        <div className="grid min-w-0 gap-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
            {t("earn.actions.amountMode.label")}
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-2 rounded-md border border-border bg-surface-0 p-1">
            {AMOUNT_MODES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onAmountModeChange(item.key)}
                disabled={flow.busy}
                className={`min-w-0 rounded-sm px-2 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] transition sm:px-3 sm:text-xs sm:tracking-[0.12em] ${
                  amountMode === item.key
                    ? "bg-surface-2 text-fg"
                    : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <span className="block truncate">{t(item.label)}</span>
              </button>
            ))}
          </div>
        </div>

        <AssetSelector
          title={t("earn.actions.asset")}
          assets={[...assets]}
          value={asset}
          onValueChange={onAssetChange}
          disabled={flow.busy}
          error={unsupportedAsset ? t("earn.errors.unsupportedWriteAsset") : undefined}
          renderLogo={(option) => <TokenLogo symbol={option.symbol} size={20} />}
          className="min-w-0"
        />

        <div className="min-w-0 rounded-md border border-border bg-surface-0 p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <label
              htmlFor="earn-amount"
              className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle"
            >
              {t("earn.actions.amount")}
            </label>
            <div className="flex min-w-0 items-center justify-end gap-2 text-[10px] font-bold uppercase tracking-[0.1em]">
              <span
                className="min-w-0 truncate text-fg-subtle"
                title={`${availableLabel}: ${availableValue}`}
              >
                {availableLabel}: <span className="font-mono text-fg-muted">{availableValue}</span>
              </span>
              <button
                type="button"
                onClick={onUseMax}
                disabled={!canUseMax}
                className="shrink-0 text-brand disabled:text-fg-subtle"
              >
                {t("earn.actions.balance.useMax")}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {amountMode === "shares" ? null : <TokenLogo symbol={symbol} size={24} />}
            <input
              id="earn-amount"
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="min-w-0 flex-1 bg-transparent font-mono text-2xl font-bold text-fg outline-none placeholder:text-fg-subtle sm:text-3xl"
            />
            <span className="shrink-0 whitespace-nowrap text-sm font-bold uppercase tracking-[0.08em] text-fg-muted sm:tracking-[0.12em]">
              {amountMode === "shares" ? t("earn.units.shares") : symbol}
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
              ? amountMode === "shares"
                ? t("earn.actions.submit.mint")
                : t("earn.actions.submit.deposit")
              : amountMode === "shares"
                ? t("earn.actions.submit.redeem")
                : t("earn.actions.submit.withdraw")}
        </button>
      </div>
    </section>
  );
}
