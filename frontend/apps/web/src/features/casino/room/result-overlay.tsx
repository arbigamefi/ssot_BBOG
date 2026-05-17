import * as React from "react";
import { cn } from "@ssot/ui";

import { formatUnits } from "../../betting/model/units";
import type { CasinoRoundResult } from "./resolution";

function formatTokenAmount(value: bigint | undefined, decimals: number, symbol: string) {
  if (value == null) return "Indexing";
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

function getOutcome(result: CasinoRoundResult | null) {
  if (!result) {
    return {
      label: "Reading result",
      tone: "indexing" as const,
      detail: "Fetching payout proof from GameHub."
    };
  }

  if (result.kind === "refunded") {
    return {
      label: "Stake refunded",
      tone: "neutral" as const,
      detail: "The refund path returned the stake after the VRF timeout window."
    };
  }

  if (result.kind === "indexing" || result.settlement?.payoutNet == null) {
    return {
      label: "Reading result",
      tone: "indexing" as const,
      detail: "Fetching BetFinalized proof directly from GameHub."
    };
  }

  const net = result.settlement.payoutNet - result.stake;
  if (net > 0n) {
    return {
      label: "Win confirmed",
      tone: "win" as const,
      detail: "Payout proof is confirmed from BetFinalized."
    };
  }
  if (net === 0n) {
    return {
      label: "Stake returned",
      tone: "neutral" as const,
      detail: "The settled payout equals the stake."
    };
  }
  return {
    label: "Loss confirmed",
    tone: "loss" as const,
    detail: "BetFinalized is confirmed with zero or below-stake payout."
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
  const outcome = getOutcome(result);
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
            Chain result
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
            <Fact label="Bet ID" value={result?.betId?.toString() ?? "—"} />
            <Fact
              label={result?.kind === "refunded" ? "Refund" : "Net payout"}
              value={formatTokenAmount(payout, assetDecimals, assetSymbol)}
            />
            <Fact label="Request ID" value={result?.requestId?.toString() ?? "—"} />
            <Fact
              label="Net result"
              value={net == null ? "Indexing" : formatTokenAmount(net, assetDecimals, assetSymbol)}
            />
            <Fact label="Random hash" value={shortHash(result?.randomHash)} />
            <Fact label="Settlement tx" value={shortHash(txHash)} href={txHref} />
          </div>
        </div>
      </div>
    </div>
  );
}
