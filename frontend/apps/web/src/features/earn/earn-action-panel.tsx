import * as React from "react";
import { useTranslations } from "next-intl";
import { AssetSelector, type AssetOption, type TxStepItem, type TxStatus } from "@ssot/ui";
import type { DomainError } from "@ssot/ssot";

import { EarnActionTrace } from "./earn-action-trace";
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
  availableLabel: string;
  availableValue: string;
  canUseMax: boolean;
  onUseMax: () => void;
  flow: EarnFlowState;
  explorerBaseUrl?: string;
  onSubmit: () => void;
  connected: boolean;
}) {
  const t = useTranslations();
  const activeTab = TABS.find((item) => item.key === tab);
  const [traceOpen, setTraceOpen] = React.useState(false);
  const shouldAutoOpenTrace =
    Boolean(flow.error) ||
    Boolean(flow.txHash) ||
    flow.status === "mined" ||
    flow.status === "failed";
  const canViewTrace = flow.hasActivity || Boolean(flow.error);

  React.useEffect(() => {
    if (shouldAutoOpenTrace) setTraceOpen(true);
  }, [shouldAutoOpenTrace]);

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

        {canViewTrace ? (
          <button
            type="button"
            onClick={() => setTraceOpen(true)}
            className="text-left text-xs font-bold uppercase tracking-[0.12em] text-brand hover:text-brand-hover"
          >
            {t("earn.actions.trace.view")}
          </button>
        ) : null}
      </div>

      {traceOpen && canViewTrace ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t("earn.actions.trace.statusDialog")}
        >
          <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-md border border-border bg-surface-1 shadow-e3">
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-fg">
                {tab === "deposit"
                  ? t("earn.actions.trace.deposit")
                  : tab === "withdraw"
                    ? t("earn.actions.trace.withdraw")
                    : t("earn.actions.trace.redeem")}
              </h2>
              <button
                type="button"
                onClick={() => setTraceOpen(false)}
                className="rounded-md border border-border-soft px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-fg-muted hover:text-fg"
              >
                {t("earn.actions.trace.close")}
              </button>
            </div>
            <div className="p-5">
              <EarnActionTrace
                title={
                  tab === "deposit"
                    ? t("earn.actions.trace.deposit")
                    : tab === "withdraw"
                      ? t("earn.actions.trace.withdraw")
                      : t("earn.actions.trace.redeem")
                }
                status={flow.status}
                steps={flow.steps}
                hasActivity={flow.hasActivity}
                error={flow.error}
                txHash={flow.txHash}
                blockNumber={flow.blockNumber}
                explorerBaseUrl={explorerBaseUrl}
                onReset={() => {
                  flow.reset();
                  setTraceOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
