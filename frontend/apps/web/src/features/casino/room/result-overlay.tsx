import * as React from "react";
import { useTranslations } from "next-intl";
import { ArrowTopRightOnSquareIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { cn } from "@ssot/ui";

import { formatUnits } from "../../betting/model/units";
import { formatNativeFee } from "./casino-round";
import type { CasinoOutcome } from "./outcome";
import type { BaccaratSide, CoinSide, DiceDirection, SicBoKind } from "./params";
import type { CasinoRoundResult } from "./resolution";

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

function getOutcome(
  result: CasinoRoundResult,
  casinoOutcome: CasinoOutcome | null | undefined,
  t: Translate
) {
  if (result.kind === "refunded") {
    return {
      label: t("casino.room.result.outcomes.refunded.label"),
      tone: "neutral" as const,
      detail: t("casino.room.result.outcomes.refunded.detail")
    };
  }

  if (result.kind === "indexing") {
    const net = casinoOutcome?.netResult;
    if (net == null) {
      return {
        label: t("casino.room.result.outcomes.revealed.label"),
        tone: "neutral" as const,
        detail: t("casino.room.result.outcomes.revealed.detail")
      };
    }
    if (net > 0n) {
      return {
        label: t("casino.room.result.outcomes.winPending.label"),
        tone: "win" as const,
        detail: t("casino.room.result.outcomes.winPending.detail")
      };
    }
    if (net === 0n) {
      return {
        label: t("casino.room.result.outcomes.returnedPending.label"),
        tone: "neutral" as const,
        detail: t("casino.room.result.outcomes.returnedPending.detail")
      };
    }
    return {
      label: t("casino.room.result.outcomes.lossPending.label"),
      tone: "loss" as const,
      detail: t("casino.room.result.outcomes.lossPending.detail")
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
  casinoOutcome?: CasinoOutcome | null;
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

function formatPlinkoRisk(risk: string, t: Translate) {
  if (risk === "low" || risk === "medium" || risk === "high") {
    return t(`casino.room.selection.plinko.${risk}`);
  }
  return risk;
}

function formatBaccaratSide(side: BaccaratSide, t: Translate) {
  return t(`casino.room.selection.baccarat.${side}`);
}

function formatSicBoBet(kind: SicBoKind, value: number, t: Translate) {
  const label = t(`casino.room.selection.sicBo.kinds.${kind}`);
  if (
    kind === "total" ||
    kind === "specificTriple" ||
    kind === "specificDouble" ||
    kind === "singleFace"
  ) {
    return `${label} ${value}`;
  }
  return label;
}

function formatSlotsMultiplier(multiplier: number) {
  return `${multiplier.toFixed(2)}x`;
}

function formatSlotsSymbols(symbols: readonly number[], t: Translate) {
  return symbols.map((symbol) => t(`casino.room.selection.slots.symbols.${symbol}`)).join(" / ");
}

function getGameResultRows(context: GameResultContext, t: Translate) {
  if (context.casinoOutcome?.kind === "dice") {
    return [
      {
        label: t("casino.room.result.facts.diceTarget"),
        value: `${context.casinoOutcome.direction === "under" ? "≤" : ">"} ${context.casinoOutcome.target}`
      },
      {
        label: t("casino.room.result.facts.diceNumber"),
        value: context.casinoOutcome.rolls.map((roll) => roll.value).join(", "),
        tone: context.casinoOutcome.rolls.some((roll) => roll.won) ? "win" : "loss"
      }
    ] satisfies GameResultRow[];
  }

  if (context.casinoOutcome?.kind === "coin-toss") {
    return [
      {
        label: t("casino.room.result.facts.coinChoice"),
        value: formatCoinSide(context.casinoOutcome.chosen, t)
      },
      {
        label: t("casino.room.result.facts.coinDrawn"),
        value: context.casinoOutcome.rolls.map((roll) => formatCoinSide(roll.value, t)).join(", "),
        tone: context.casinoOutcome.rolls.some((roll) => roll.won) ? "win" : "loss"
      }
    ] satisfies GameResultRow[];
  }

  if (context.casinoOutcome?.kind === "roulette") {
    return [
      {
        label: t("casino.room.result.facts.rouletteBet"),
        value: formatList(context.casinoOutcome.selectedNumbers)
      },
      {
        label: t("casino.room.result.facts.rouletteWinningNumber"),
        value: context.casinoOutcome.rolls.map((roll) => roll.value).join(", "),
        tone: context.casinoOutcome.rolls.some((roll) => roll.won) ? "win" : "loss"
      }
    ] satisfies GameResultRow[];
  }

  if (context.casinoOutcome?.kind === "keno") {
    return [
      {
        label: t("casino.room.result.facts.kenoPicked"),
        value: formatList(context.casinoOutcome.pickedNumbers)
      },
      {
        label: t("casino.room.result.facts.kenoDrawn"),
        value: context.casinoOutcome.draws.map((draw) => draw.numbers.join(", ")).join(" / "),
        tone: context.casinoOutcome.draws.some((draw) => draw.won) ? "win" : "loss"
      },
      {
        label: t("casino.room.result.facts.kenoHits"),
        value: context.casinoOutcome.draws.map((draw) => draw.hits).join(", ")
      }
    ] satisfies GameResultRow[];
  }

  if (context.casinoOutcome?.kind === "plinko") {
    return [
      {
        label: t("casino.room.result.facts.plinkoRisk"),
        value: formatPlinkoRisk(context.casinoOutcome.risk, t)
      },
      {
        label: t("casino.room.result.facts.plinkoSlot"),
        value: context.casinoOutcome.rolls.map((roll) => roll.bucket).join(", "),
        tone:
          context.casinoOutcome.netResult > 0n
            ? "win"
            : context.casinoOutcome.netResult < 0n
              ? "loss"
              : "neutral"
      },
      {
        label: t("casino.room.result.facts.plinkoPath"),
        value: context.casinoOutcome.rolls.map((roll) => roll.path.join("")).join(" / ")
      },
      {
        label: t("casino.room.result.facts.plinkoMultiplier"),
        value: context.casinoOutcome.rolls
          .map((roll) => `${(roll.factorBps / 10_000).toFixed(roll.factorBps >= 100_000 ? 1 : 2)}x`)
          .join(", ")
      }
    ] satisfies GameResultRow[];
  }

  if (context.casinoOutcome?.kind === "baccarat") {
    return [
      {
        label: t("casino.room.result.facts.baccaratChoice"),
        value: formatBaccaratSide(context.casinoOutcome.side, t)
      },
      {
        label: t("casino.room.result.facts.baccaratWinner"),
        value: context.casinoOutcome.rolls
          .map((roll) => formatBaccaratSide(roll.outcome, t))
          .join(", "),
        tone:
          context.casinoOutcome.netResult > 0n
            ? "win"
            : context.casinoOutcome.netResult < 0n
              ? "loss"
              : "neutral"
      },
      {
        label: t("casino.room.result.facts.baccaratPlayerTotal"),
        value: context.casinoOutcome.rolls.map((roll) => roll.playerTotal).join(", ")
      },
      {
        label: t("casino.room.result.facts.baccaratBankerTotal"),
        value: context.casinoOutcome.rolls.map((roll) => roll.bankerTotal).join(", ")
      },
      {
        label: t("casino.room.result.facts.baccaratPlayerCards"),
        value: context.casinoOutcome.rolls.map((roll) => formatList(roll.playerCards)).join(" / ")
      },
      {
        label: t("casino.room.result.facts.baccaratBankerCards"),
        value: context.casinoOutcome.rolls.map((roll) => formatList(roll.bankerCards)).join(" / ")
      }
    ] satisfies GameResultRow[];
  }

  if (context.casinoOutcome?.kind === "slots") {
    return [
      {
        label: t("casino.room.result.facts.slotsProfile"),
        value: t(`casino.room.selection.slots.profiles.${context.casinoOutcome.profile}`)
      },
      {
        label: t("casino.room.result.facts.slotsSymbols"),
        value: context.casinoOutcome.rolls
          .map((roll) => formatSlotsSymbols(roll.symbols, t))
          .join(" / "),
        tone:
          context.casinoOutcome.netResult > 0n
            ? "win"
            : context.casinoOutcome.netResult < 0n
              ? "loss"
              : "neutral"
      },
      {
        label: t("casino.room.result.facts.slotsMultiplier"),
        value: context.casinoOutcome.rolls
          .map((roll) => formatSlotsMultiplier(roll.multiplier))
          .join(", ")
      },
      {
        label: t("casino.room.result.facts.slotsJackpot"),
        value: context.casinoOutcome.rolls.some((roll) => roll.jackpot)
          ? t("casino.room.selection.slots.yes")
          : t("casino.room.selection.slots.no"),
        tone: context.casinoOutcome.rolls.some((roll) => roll.jackpot) ? "win" : "neutral"
      }
    ] satisfies GameResultRow[];
  }

  if (context.casinoOutcome?.kind === "sic-bo") {
    return [
      {
        label: t("casino.room.result.facts.sicBoBet"),
        value: formatSicBoBet(context.casinoOutcome.betKind, context.casinoOutcome.betValue, t)
      },
      {
        label: t("casino.room.result.facts.sicBoDice"),
        value: context.casinoOutcome.rolls.map((roll) => roll.dice.join(" / ")).join(", "),
        tone:
          context.casinoOutcome.netResult > 0n
            ? "win"
            : context.casinoOutcome.netResult < 0n
              ? "loss"
              : "neutral"
      },
      {
        label: t("casino.room.result.facts.sicBoTotal"),
        value: context.casinoOutcome.rolls.map((roll) => roll.total).join(", ")
      },
      {
        label: t("casino.room.result.facts.sicBoTriple"),
        value: context.casinoOutcome.rolls
          .map((roll) =>
            roll.triple ? t("casino.room.selection.slots.yes") : t("casino.room.selection.slots.no")
          )
          .join(", ")
      },
      {
        label: t("casino.room.result.facts.sicBoMultiplier"),
        value: context.casinoOutcome.rolls
          .map((roll) => `${(roll.factorBps / 10_000).toFixed(roll.factorBps >= 100_000 ? 1 : 2)}x`)
          .join(", ")
      }
    ] satisfies GameResultRow[];
  }

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
  casinoOutcome,
  onClose
}: {
  result: CasinoRoundResult;
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
  casinoOutcome?: CasinoOutcome | null;
  onClose?: () => void;
}) {
  const t = useTranslations();
  const outcome = getOutcome(result, casinoOutcome, t);
  const txHash =
    result.kind === "refunded"
      ? result.refund.txHash
      : result.kind === "settled"
        ? result.settlement.txHash
        : undefined;
  const txHref = explorerTxUrl(chainId, txHash);
  const payout =
    result.kind === "refunded"
      ? result.refund.refundAmount
      : result.kind === "settled"
        ? result.settlement.payoutNet
        : casinoOutcome?.playerOwed;
  const net = payout == null ? undefined : payout - result.stake;
  const gameRows = getGameResultRows(
    {
      gameSlug,
      resultNum,
      diceDirection,
      diceTarget,
      coinSide,
      rouletteSpots,
      kenoSpots,
      kenoResultDrawn,
      casinoOutcome
    },
    t
  );
  const payoutLabel =
    result.kind === "refunded"
      ? t("casino.room.result.facts.refund")
      : result.kind === "indexing"
        ? t("casino.room.result.facts.expectedPayout")
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
                value={
                  payout == null
                    ? t("casino.room.result.facts.pending")
                    : formatMultiplier(payout, result.stake)
                }
              />
              <DetailRow
                label={t("casino.room.result.facts.betAmount")}
                value={formatTokenAmount(result.stake, assetDecimals, assetSymbol)}
              />
              <DetailRow
                label={payoutLabel}
                value={
                  payout == null
                    ? t("casino.room.result.facts.pending")
                    : formatTokenAmount(payout, assetDecimals, assetSymbol)
                }
              />
              <DetailRow
                label={t("casino.room.result.facts.netResult")}
                value={
                  net == null
                    ? t("casino.room.result.facts.pending")
                    : formatSignedTokenAmount(net, assetDecimals, assetSymbol)
                }
                tone={net == null ? "neutral" : net > 0n ? "win" : net < 0n ? "loss" : "neutral"}
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
                value={
                  shortHash(txHash) === "—"
                    ? t("casino.room.result.facts.pending")
                    : shortHash(txHash)
                }
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
                {t("casino.room.result.actions.settlementPending")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
