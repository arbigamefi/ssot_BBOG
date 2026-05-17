import * as React from "react";
import { useTranslations } from "next-intl";
import { ArrowTopRightOnSquareIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { cn } from "@ssot/ui";

import { formatUnits } from "../../betting/model/units";
import { formatNativeFee } from "./casino-round";
import type { CoinSide, DiceDirection } from "./params";
import type { CasinoTerminalRoundResult } from "./resolution";

function formatTokenAmount(value: bigint, decimals: number, symbol: string) {
  const raw = formatUnits(value, decimals);
  const [intPart = "0", fracPart = ""] = raw.split(".");
  const fraction = fracPart.slice(0, 4).replace(/0+$/, "");
  return `${intPart}${fraction ? `.${fraction}` : ""} ${symbol}`;
}

function shortHash(value: string | undefined) {
  if (!value) return "—";
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function formatAddress(value: string | undefined) {
  if (!value) return "—";
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function formatSignedTokenAmount(value: bigint, decimals: number, symbol: string) {
  if (value === 0n) return formatTokenAmount(0n, decimals, symbol);
  const sign = value > 0n ? "+ " : "- ";
  return `${sign}${formatTokenAmount(value > 0n ? value : -value, decimals, symbol)}`;
}

function formatMultiplier(payout: bigint, stake: bigint) {
  if (stake <= 0n) return "—";
  const scaled = (payout * 100n) / stake;
  const whole = scaled / 100n;
  const fraction = String(scaled % 100n).padStart(2, "0");
  return `${whole}.${fraction}x`;
}

function formatResolvedAt(value: number | undefined) {
  if (!value) return "—";
  return new Date(value * 1000).toLocaleString();
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

function getOutcome(result: CasinoTerminalRoundResult, t: Translate) {
  if (result.kind === "refunded") {
    return {
      label: t("casino.room.result.outcomes.refunded.label"),
      tone: "neutral" as const,
      detail: t("casino.room.result.outcomes.refunded.detail")
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

type GameResultContext = {
  gameSlug: string;
  resultNum: number | null;
  diceDirection: DiceDirection;
  diceTarget: number;
  coinSide: CoinSide;
  rouletteSpots: readonly string[];
  kenoSpots: readonly number[];
  kenoResultDrawn: readonly number[];
};

type DetailTone = "win" | "loss" | "accent" | "neutral";

type GameResultRow = {
  label: string;
  value: string;
  tone?: DetailTone;
};

function formatList(values: readonly (number | string)[]) {
  return values.length > 0 ? values.join(", ") : "—";
}

function formatCoinSide(side: CoinSide, t: Translate) {
  return side === "HEADS"
    ? t("casino.room.selection.coin.heads")
    : t("casino.room.selection.coin.tails");
}

function getGameResultRows(context: GameResultContext, t: Translate) {
  if (context.gameSlug === "dice") {
    const rows: GameResultRow[] = [
      {
        label: t("casino.room.result.facts.diceTarget"),
        value: `${context.diceDirection === "under" ? "<" : ">"} ${context.diceTarget}`
      }
    ];
    if (context.resultNum != null) {
      rows.push({
        label: t("casino.room.result.facts.diceNumber"),
        value: context.resultNum.toString(),
        tone: "accent" as const
      });
    }
    return rows;
  }

  if (context.gameSlug === "coin-toss") {
    const rows: GameResultRow[] = [
      {
        label: t("casino.room.result.facts.coinChoice"),
        value: formatCoinSide(context.coinSide, t)
      }
    ];
    if (context.resultNum != null) {
      rows.push({
        label: t("casino.room.result.facts.coinDrawn"),
        value: formatCoinSide(context.resultNum === 1 ? "HEADS" : "TAILS", t),
        tone: "accent" as const
      });
    }
    return rows;
  }

  if (context.gameSlug === "roulette") {
    const rows: GameResultRow[] = [
      {
        label: t("casino.room.result.facts.rouletteBet"),
        value: formatList(context.rouletteSpots)
      }
    ];
    if (context.resultNum != null) {
      rows.push({
        label: t("casino.room.result.facts.rouletteWinningNumber"),
        value: context.resultNum.toString(),
        tone: "accent" as const
      });
    }
    return rows;
  }

  if (context.gameSlug === "keno") {
    const hits = context.kenoResultDrawn.filter((n) => context.kenoSpots.includes(n)).length;
    const rows: GameResultRow[] = [
      {
        label: t("casino.room.result.facts.kenoPicked"),
        value: formatList(context.kenoSpots)
      }
    ];
    if (context.kenoResultDrawn.length > 0) {
      rows.push(
        {
          label: t("casino.room.result.facts.kenoDrawn"),
          value: formatList(context.kenoResultDrawn),
          tone: "accent" as const
        },
        {
          label: t("casino.room.result.facts.kenoHits"),
          value: hits.toString()
        }
      );
    }
    return rows;
  }

  return [];
}

function DetailRow({
  label,
  value,
  href,
  tone
}: {
  label: string;
  value: React.ReactNode;
  href?: string;
  tone?: DetailTone;
}) {
  const valueClass = cn(
    "font-mono text-sm font-bold text-fg",
    tone === "win" && "text-success",
    tone === "loss" && "text-danger",
    tone === "accent" && "text-accent",
    tone === "neutral" && "text-fg-muted"
  );

  return (
    <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start gap-4 py-2.5">
      <p className="text-sm font-semibold text-fg-muted">{label}</p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className={cn(
            valueClass,
            "inline-flex min-w-0 items-center gap-1 truncate text-brand hover:text-brand/80"
          )}
        >
          {value}
          <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 flex-shrink-0" />
        </a>
      ) : (
        <p className={cn(valueClass, "truncate")}>{value}</p>
      )}
    </div>
  );
}

function DetailSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface-2 p-5 text-left">
      {title && <h4 className="mb-3 text-sm font-black text-fg">{title}</h4>}
      <div className="divide-y divide-border-soft">{children}</div>
    </section>
  );
}

export function GameRoomResultOverlay({
  result,
  chainId,
  assetSymbol = "USDC",
  assetDecimals = 6,
  gameSlug,
  resultNum,
  diceDirection,
  diceTarget,
  coinSide,
  rouletteSpots,
  kenoSpots,
  kenoResultDrawn,
  onClose
}: {
  result: CasinoTerminalRoundResult;
  chainId?: number;
  assetSymbol?: string;
  assetDecimals?: number;
  gameSlug: string;
  resultNum: number | null;
  diceDirection: DiceDirection;
  diceTarget: number;
  coinSide: CoinSide;
  rouletteSpots: readonly string[];
  kenoSpots: readonly number[];
  kenoResultDrawn: readonly number[];
  onClose?: () => void;
}) {
  const t = useTranslations();
  const outcome = getOutcome(result, t);
  const txHash = result.kind === "refunded" ? result.refund.txHash : result.settlement.txHash;
  const txHref = explorerTxUrl(chainId, txHash);
  const payout =
    result.kind === "refunded" ? result.refund.refundAmount : result.settlement.payoutNet;
  const net = payout - result.stake;
  const gameRows = getGameResultRows(
    {
      gameSlug,
      resultNum,
      diceDirection,
      diceTarget,
      coinSide,
      rouletteSpots,
      kenoSpots,
      kenoResultDrawn
    },
    t
  );
  const payoutLabel =
    result.kind === "refunded"
      ? t("casino.room.result.facts.refund")
      : t("casino.room.result.facts.payout");

  return (
    <div className="pointer-events-auto absolute inset-0 z-[60] flex flex-col items-center justify-center bg-surface-0/82 p-4 backdrop-blur-md animate-in fade-in zoom-in">
      <div className="relative flex max-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-surface-1 p-6 text-center shadow-e3 transition-transform md:p-8">
        <div
          className={cn(
            "pointer-events-none absolute inset-x-8 top-0 h-24 blur-[90px]",
            outcome.tone === "win" && "bg-success/30",
            outcome.tone === "loss" && "bg-danger/25",
            outcome.tone === "neutral" && "bg-brand/20"
          )}
        />
        <button
          type="button"
          onClick={onClose}
          aria-label={t("casino.room.result.actions.close")}
          className="absolute right-5 top-5 z-10 rounded-md border border-border bg-surface-2 p-2 text-fg-muted transition-colors hover:border-brand/40 hover:text-fg"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        <div className="relative min-h-0 overflow-y-auto pr-1">
          <p className="text-left text-2xl font-black text-fg">{t("casino.room.result.title")}</p>
          <h3
            className={cn(
              "mt-5 text-left text-4xl font-black tracking-normal",
              outcome.tone === "win" && "text-success",
              outcome.tone === "loss" && "text-danger",
              outcome.tone === "neutral" && "text-fg"
            )}
          >
            {outcome.label}
          </h3>
          <p className="mt-2 text-left text-sm leading-6 text-fg-muted">{outcome.detail}</p>

          <div className="mt-6 grid gap-4">
            <DetailSection>
              <DetailRow
                label={t("casino.room.result.facts.status")}
                value={outcome.label}
                tone={outcome.tone === "win" ? "win" : outcome.tone === "loss" ? "loss" : "neutral"}
              />
              <DetailRow
                label={t("casino.room.result.facts.player")}
                value={formatAddress(result.player)}
              />
              <DetailRow
                label={t("casino.room.result.facts.multiplier")}
                value={formatMultiplier(payout, result.stake)}
              />
              <DetailRow
                label={t("casino.room.result.facts.betAmount")}
                value={formatTokenAmount(result.stake, assetDecimals, assetSymbol)}
              />
              <DetailRow
                label={payoutLabel}
                value={formatTokenAmount(payout, assetDecimals, assetSymbol)}
              />
              <DetailRow
                label={t("casino.room.result.facts.netResult")}
                value={formatSignedTokenAmount(net, assetDecimals, assetSymbol)}
                tone={net > 0n ? "win" : net < 0n ? "loss" : "neutral"}
              />
            </DetailSection>

            {gameRows.length > 0 && (
              <DetailSection title={t("casino.room.result.sections.gameResult")}>
                {gameRows.map((row) => (
                  <DetailRow key={row.label} label={row.label} value={row.value} tone={row.tone} />
                ))}
              </DetailSection>
            )}

            <DetailSection title={t("casino.room.result.sections.fairnessData")}>
              <DetailRow
                label={t("casino.room.result.facts.betId")}
                value={result.betId.toString()}
              />
              <DetailRow
                label={t("casino.room.result.facts.resolvedTime")}
                value={formatResolvedAt(result.resolvedAt)}
              />
              <DetailRow
                label={t("casino.room.result.facts.vrfFee")}
                value={formatNativeFee(result.vrfFeeCharged)}
              />
              <DetailRow
                label={t("casino.room.result.facts.requestId")}
                value={result.requestId.toString()}
              />
              <DetailRow
                label={t("casino.room.result.facts.randomHash")}
                value={shortHash(result.randomHash)}
              />
              <DetailRow
                label={t("casino.room.result.facts.settlementTx")}
                value={shortHash(txHash)}
                href={txHref}
              />
            </DetailSection>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border bg-surface-2 px-5 py-3 text-sm font-black text-fg transition-colors hover:border-brand/40 hover:bg-surface-3"
            >
              {t("casino.room.result.actions.close")}
            </button>
            {txHref ? (
              <a
                href={txHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand/40 bg-brand px-5 py-3 text-sm font-black text-fg-inverse shadow-glow transition-colors hover:bg-brand-hover"
              >
                {t("casino.room.result.actions.viewSettlement")}
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="rounded-lg border border-border bg-surface-2 px-5 py-3 text-sm font-black text-fg-subtle"
              >
                {t("casino.room.result.actions.viewSettlement")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
