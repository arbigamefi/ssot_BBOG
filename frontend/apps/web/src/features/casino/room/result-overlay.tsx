import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import { formatUnits } from "../../betting/model/units";
import type { CasinoRoundResult } from "./resolution";

function formatTokenAmount(
  value: bigint | undefined,
  decimals: number,
  symbol: string,
  indexingLabel: string
) {
  if (value == null) return indexingLabel;
  const raw = formatUnits(value, decimals);
  const [intPart = "0", fracPart = ""] = raw.split(".");
  const fraction = fracPart.slice(0, 4).replace(/0+$/, "");
  return `${intPart}${fraction ? `.${fraction}` : ""} ${symbol}`;
}

function shortHash(value: string | undefined) {
  if (!value) return "—";
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function explorerTxUrl(chainId: number | undefined, txHash: string | undefined) {
  if (!txHash) return undefined;
  if (chainId === 84532) return `https://sepolia.basescan.org/tx/${txHash}`;
  if (chainId === 8453) return `https://basescan.org/tx/${txHash}`;
  if (chainId === 421614) return `https://sepolia.arbiscan.io/tx/${txHash}`;
  if (chainId === 42161) return `https://arbiscan.io/tx/${txHash}`;
  return undefined;
}

type Translate = ReturnType<typeof useTranslations>;

function getOutcome(result: CasinoRoundResult | null, t: Translate) {
  if (!result) {
    return {
      label: t("casino.room.result.outcomes.reading.label"),
      tone: "indexing" as const,
      detail: t("casino.room.result.outcomes.reading.detail")
    };
  }

  if (result.kind === "refunded") {
    return {
      label: t("casino.room.result.outcomes.refunded.label"),
      tone: "neutral" as const,
      detail: t("casino.room.result.outcomes.refunded.detail")
    };
  }

  if (result.kind === "indexing" || result.settlement?.payoutNet == null) {
    return {
      label: t("casino.room.result.outcomes.reading.label"),
      tone: "indexing" as const,
      detail: t("casino.room.result.outcomes.readingFinalized.detail")
    };
  }

  const net = result.settlement.payoutNet - result.stake;
  if (net > 0n) {
    return {
      label: t("casino.room.result.outcomes.win.label"),
      tone: "win" as const,
      detail: t("casino.room.result.outcomes.win.detail")
    };
  }
  if (net === 0n) {
    return {
      label: t("casino.room.result.outcomes.returned.label"),
      tone: "neutral" as const,
      detail: t("casino.room.result.outcomes.returned.detail")
    };
  }
  return {
    label: t("casino.room.result.outcomes.loss.label"),
    tone: "loss" as const,
    detail: t("casino.room.result.outcomes.loss.detail")
  };
}

function Fact({ label, value, href }: { label: string; value: React.ReactNode; href?: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-2 p-3 text-left">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle">{label}</p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block truncate font-mono text-xs font-bold text-brand hover:text-brand/80"
        >
          {value}
        </a>
      ) : (
        <p className="mt-1 truncate font-mono text-xs font-bold text-fg">{value}</p>
      )}
    </div>
  );
}

export function GameRoomResultOverlay({
  result,
  chainId,
  assetSymbol = "USDC",
  assetDecimals = 6
}: {
  result: CasinoRoundResult | null;
  chainId?: number;
  assetSymbol?: string;
  assetDecimals?: number;
}) {
  const t = useTranslations();
  const indexingLabel = t("casino.room.result.indexing");
  const outcome = getOutcome(result, t);
  const txHash = result?.settlement?.txHash ?? result?.refund?.txHash;
  const txHref = explorerTxUrl(chainId, txHash);
  const payout =
    result?.kind === "refunded" ? result.refund?.refundAmount : result?.settlement?.payoutNet;
  const net =
    result?.kind === "refunded"
      ? result.refund?.refundAmount == null
        ? undefined
        : result.refund.refundAmount - result.stake
      : result?.settlement?.payoutNet == null
        ? undefined
        : result.settlement.payoutNet - result.stake;

  return (
    <div className="pointer-events-auto absolute inset-0 z-[60] flex flex-col items-center justify-center bg-surface-0/80 backdrop-blur-md animate-in fade-in zoom-in">
      <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-surface-1 p-8 text-center shadow-e3 transition-transform">
        <div
          className={cn(
            "absolute inset-x-8 top-0 h-24 blur-[90px]",
            outcome.tone === "win" && "bg-success/30",
            outcome.tone === "loss" && "bg-danger/25",
            outcome.tone === "neutral" && "bg-brand/20",
            outcome.tone === "indexing" && "bg-accent/20"
          )}
        />
        <div className="relative">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-fg-subtle">
            {t("casino.room.result.title")}
          </p>
          <h3
            className={cn(
              "mt-3 text-3xl font-black tracking-normal",
              outcome.tone === "win" && "text-success",
              outcome.tone === "loss" && "text-danger",
              outcome.tone === "neutral" && "text-fg",
              outcome.tone === "indexing" && "text-accent"
            )}
          >
            {outcome.label}
          </h3>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-fg-muted">{outcome.detail}</p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Fact
              label={t("casino.room.result.facts.betId")}
              value={result?.betId?.toString() ?? "—"}
            />
            <Fact
              label={
                result?.kind === "refunded"
                  ? t("casino.room.result.facts.refund")
                  : t("casino.room.result.facts.netPayout")
              }
              value={formatTokenAmount(payout, assetDecimals, assetSymbol, indexingLabel)}
            />
            <Fact
              label={t("casino.room.result.facts.requestId")}
              value={result?.requestId?.toString() ?? "—"}
            />
            <Fact
              label={t("casino.room.result.facts.netResult")}
              value={
                net == null
                  ? indexingLabel
                  : formatTokenAmount(net, assetDecimals, assetSymbol, indexingLabel)
              }
            />
            <Fact
              label={t("casino.room.result.facts.randomHash")}
              value={shortHash(result?.randomHash)}
            />
            <Fact
              label={t("casino.room.result.facts.settlementTx")}
              value={shortHash(txHash)}
              href={txHref}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
