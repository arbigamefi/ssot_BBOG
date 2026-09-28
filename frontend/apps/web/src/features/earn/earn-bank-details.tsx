import * as React from "react";
import { useTranslations } from "next-intl";
import { EarnBankSummary } from "./earn-bank-summary";
import { EarnRiskPanel } from "./earn-risk-panel";
import type { EarnBankData } from "./types";

export function EarnBankDetails({
  data,
  decimals,
  symbol,
  loading,
  error,
  releaseDigest
}: {
  data?: EarnBankData;
  decimals: number;
  symbol: string;
  loading: boolean;
  error?: string;
  releaseDigest?: string;
}) {
  const t = useTranslations();
  const [diligenceTab, setDiligenceTab] = React.useState<"reserve" | "risk">("reserve");
  return (
    <section className="min-w-0 rounded-md border border-border bg-surface-1 shadow-e2 xl:col-start-1 xl:row-start-1">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="grid min-w-0 grid-cols-2 gap-1 rounded-md border border-border-soft bg-surface-0 p-1">
          {[
            {
              key: "reserve" as const,
              label: t("earn.summary.capitalPosture.title")
            },
            {
              key: "risk" as const,
              label: t("earn.risk.title")
            }
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setDiligenceTab(item.key)}
              className={`min-w-0 rounded-sm px-2 py-2 text-[11px] font-bold uppercase tracking-[0.08em] transition sm:px-3 sm:text-xs sm:tracking-[0.12em] ${
                diligenceTab === item.key
                  ? "bg-brand text-fg-inverse"
                  : "text-fg-muted hover:bg-surface-2 hover:text-fg"
              }`}
            >
              <span className="block truncate">{item.label}</span>
            </button>
          ))}
        </div>
        <span className="rounded-full border border-success/30 bg-success-soft px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-success">
          {diligenceTab === "reserve"
            ? t("earn.summary.capitalPosture.readModel")
            : t("earn.risk.readModel")}
        </span>
      </div>
      {diligenceTab === "reserve" ? (
        <EarnBankSummary
          data={data}
          decimals={decimals}
          symbol={symbol}
          loading={loading}
          error={error}
          embedded
        />
      ) : (
        <EarnRiskPanel
          data={data}
          decimals={decimals}
          symbol={symbol}
          releaseDigest={releaseDigest}
          embedded
        />
      )}
    </section>
  );
}
